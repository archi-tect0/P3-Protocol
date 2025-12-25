export interface SiteProfileSeed {
  domain: string;
  name: string;
  category: string;
  iconUrl?: string;
  description?: string;
  defaultActions: string[];
  selectorsJson?: Record<string, string>;
  loginMacros?: Record<string, any>;
  safe: boolean;
  featured: boolean;
  sortOrder: number;
}

export const MESSAGING_PROFILES: SiteProfileSeed[] = [
  { domain: 'messages.google.com', name: 'Google Messages', category: 'messaging', iconUrl: 'https://www.gstatic.com/images/branding/product/1x/messages_512dp.png', description: 'SMS/RCS messaging from browser', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { conversations: '[role="listbox"]', unreadCount: '.unread-count' }, loginMacros: { type: 'qr-code', steps: ['scan QR from phone'] }, safe: true, featured: true, sortOrder: 1 },
  { domain: 'web.telegram.org', name: 'Telegram Web', category: 'messaging', iconUrl: 'https://telegram.org/img/t_logo.png', description: 'Telegram messaging platform', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { chatList: '.chat-list', messageInput: '.composer-input' }, loginMacros: { type: 'qr-code', steps: ['scan QR from phone'] }, safe: true, featured: true, sortOrder: 2 },
  { domain: 'web.whatsapp.com', name: 'WhatsApp Web', category: 'messaging', iconUrl: 'https://static.whatsapp.net/rsrc.php/v3/y7/r/DSxOAUB0raA.png', description: 'WhatsApp messaging', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { chatList: '[data-testid="chat-list"]', messageInput: '[data-testid="conversation-compose-box-input"]' }, loginMacros: { type: 'qr-code', steps: ['scan QR from phone'] }, safe: true, featured: true, sortOrder: 3 },
  { domain: 'discord.com', name: 'Discord', category: 'messaging', iconUrl: 'https://discord.com/assets/847541504914fd33810e70a0ea73177e.ico', description: 'Gaming and community chat', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { channelList: '[class*="channels"]', messageInput: '[class*="slateTextArea"]' }, loginMacros: { type: 'credentials', steps: ['enter email', 'enter password'] }, safe: true, featured: true, sortOrder: 4 },
  { domain: 'slack.com', name: 'Slack', category: 'messaging', iconUrl: 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png', description: 'Team communication', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { channelList: '[data-qa="channel_sidebar"]', messageInput: '[data-qa="message_input"]' }, loginMacros: { type: 'oauth', steps: ['workspace signin'] }, safe: true, featured: true, sortOrder: 5 },
  { domain: 'messenger.com', name: 'Facebook Messenger', category: 'messaging', iconUrl: 'https://static.xx.fbcdn.net/rsrc.php/yg/r/4_vfHVmZ5XD.ico', description: 'Meta messaging platform', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { chatList: '[aria-label="Chats"]', messageInput: '[aria-label="Message"]' }, loginMacros: { type: 'credentials', steps: ['login with Facebook'] }, safe: true, featured: false, sortOrder: 6 },
  { domain: 'signal.org', name: 'Signal', category: 'messaging', iconUrl: 'https://signal.org/assets/images/header/logo.png', description: 'Encrypted messaging', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], loginMacros: { type: 'qr-code', steps: ['link device'] }, safe: true, featured: false, sortOrder: 7 },
  { domain: 'teams.microsoft.com', name: 'Microsoft Teams', category: 'messaging', iconUrl: 'https://statics.teams.cdn.office.net/evergreen-assets/apps/teams_osx_32x32.png', description: 'Microsoft collaboration', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], loginMacros: { type: 'oauth', steps: ['Microsoft login'] }, safe: true, featured: true, sortOrder: 8 },
  { domain: 'meet.google.com', name: 'Google Meet', category: 'messaging', iconUrl: 'https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v1/web-96dp/logo_meet_2020q4_color_2x_web_96dp.png', description: 'Video conferencing', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
  { domain: 'zoom.us', name: 'Zoom', category: 'messaging', iconUrl: 'https://st1.zoom.us/zoom.ico', description: 'Video meetings', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], loginMacros: { type: 'credentials', steps: ['sign in'] }, safe: true, featured: false, sortOrder: 10 },
];

export const SOCIAL_PROFILES: SiteProfileSeed[] = [
  { domain: 'twitter.com', name: 'Twitter/X', category: 'social', iconUrl: 'https://abs.twimg.com/favicons/twitter.ico', description: 'Social microblogging', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { timeline: '[data-testid="primaryColumn"]', tweetComposer: '[data-testid="tweetTextarea_0"]' }, loginMacros: { type: 'credentials', steps: ['enter username', 'enter password'] }, safe: true, featured: true, sortOrder: 1 },
  { domain: 'x.com', name: 'X', category: 'social', iconUrl: 'https://abs.twimg.com/favicons/twitter.ico', description: 'X social platform', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { timeline: '[data-testid="primaryColumn"]' }, loginMacros: { type: 'credentials', steps: ['sign in'] }, safe: true, featured: true, sortOrder: 2 },
  { domain: 'facebook.com', name: 'Facebook', category: 'social', iconUrl: 'https://static.xx.fbcdn.net/rsrc.php/yD/r/d4ZIVX-5C-b.ico', description: 'Social networking', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { feed: '[role="feed"]', composer: '[data-pagelet="FeedComposer"]' }, loginMacros: { type: 'credentials', steps: ['enter email', 'enter password'] }, safe: true, featured: true, sortOrder: 3 },
  { domain: 'instagram.com', name: 'Instagram', category: 'social', iconUrl: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsNE-OHk_8a.png', description: 'Photo and video sharing', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], loginMacros: { type: 'credentials', steps: ['login'] }, safe: true, featured: true, sortOrder: 4 },
  { domain: 'linkedin.com', name: 'LinkedIn', category: 'social', iconUrl: 'https://static.licdn.com/aero-v1/sc/h/al2o9zrvru7aqj8e1x2rzsrca', description: 'Professional networking', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { feed: '.feed-container', profile: '.profile-card' }, loginMacros: { type: 'credentials', steps: ['sign in'] }, safe: true, featured: true, sortOrder: 5 },
  { domain: 'reddit.com', name: 'Reddit', category: 'social', iconUrl: 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png', description: 'Community discussions', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { feed: '[data-testid="posts-list"]' }, loginMacros: { type: 'credentials', steps: ['log in'] }, safe: true, featured: true, sortOrder: 6 },
  { domain: 'tiktok.com', name: 'TikTok', category: 'social', iconUrl: 'https://sf16-website-login.neutral.ttwstatic.com/obj/tiktok_web_login_static/tiktok/webapp/main/webapp-desktop/8152caf0c8e8bc67ae0d.ico', description: 'Short-form video', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 7 },
  { domain: 'pinterest.com', name: 'Pinterest', category: 'social', iconUrl: 'https://s.pinimg.com/webapp/favicon-56d3c242.png', description: 'Visual discovery', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
  { domain: 'snapchat.com', name: 'Snapchat Web', category: 'social', iconUrl: 'https://www.snap.com/favicon.ico', description: 'Snap messaging', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
  { domain: 'threads.net', name: 'Threads', category: 'social', iconUrl: 'https://static.cdninstagram.com/rsrc.php/v3/yS/r/ajlEU-wEDyo.png', description: 'Text-based social', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 10 },
  { domain: 'mastodon.social', name: 'Mastodon', category: 'social', iconUrl: 'https://mastodon.social/packs/media/icons/favicon-32x32-c810e37a.png', description: 'Decentralized social', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 11 },
  { domain: 'bluesky.app', name: 'Bluesky', category: 'social', iconUrl: 'https://bsky.app/static/favicon-32x32.png', description: 'Decentralized social', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 12 },
];

export const EMAIL_PROFILES: SiteProfileSeed[] = [
  { domain: 'mail.google.com', name: 'Gmail', category: 'email', iconUrl: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico', description: 'Google email', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { inbox: '[role="main"]', unreadCount: '.aim .bsU', composeButton: '.T-I-KE' }, loginMacros: { type: 'oauth', steps: ['Google sign-in'] }, safe: true, featured: true, sortOrder: 1 },
  { domain: 'outlook.live.com', name: 'Outlook', category: 'email', iconUrl: 'https://res.cdn.office.net/assets/mail/pwa/v1/pngs/fluentIcon_owa_m.png', description: 'Microsoft email', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { inbox: '[role="main"]', compose: '[aria-label="New mail"]' }, loginMacros: { type: 'oauth', steps: ['Microsoft login'] }, safe: true, featured: true, sortOrder: 2 },
  { domain: 'mail.yahoo.com', name: 'Yahoo Mail', category: 'email', iconUrl: 'https://s.yimg.com/rz/l/favicon.ico', description: 'Yahoo email', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], loginMacros: { type: 'credentials', steps: ['sign in'] }, safe: true, featured: false, sortOrder: 3 },
  { domain: 'proton.me', name: 'ProtonMail', category: 'email', iconUrl: 'https://proton.me/favicons/android-chrome-192x192.png', description: 'Encrypted email', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], loginMacros: { type: 'credentials', steps: ['sign in'] }, safe: true, featured: true, sortOrder: 4 },
  { domain: 'icloud.com', name: 'iCloud Mail', category: 'email', iconUrl: 'https://www.apple.com/favicon.ico', description: 'Apple email', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], loginMacros: { type: 'oauth', steps: ['Apple ID login'] }, safe: true, featured: false, sortOrder: 5 },
  { domain: 'tutanota.com', name: 'Tutanota', category: 'email', iconUrl: 'https://tutanota.com/favicon.ico', description: 'Secure email', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 6 },
  { domain: 'fastmail.com', name: 'Fastmail', category: 'email', iconUrl: 'https://www.fastmail.com/assets/favicon.ico', description: 'Fast email service', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'zoho.com', name: 'Zoho Mail', category: 'email', iconUrl: 'https://www.zoho.com/favicon.ico', description: 'Business email', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
];

export const STREAMING_PROFILES: SiteProfileSeed[] = [
  { domain: 'netflix.com', name: 'Netflix', category: 'streaming', iconUrl: 'https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png', description: 'Stream movies and TV', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], selectorsJson: { continueWatching: '.continue-watching-row', playButton: '[data-uia="play-button"]' }, loginMacros: { type: 'credentials', steps: ['enter email', 'enter password'] }, safe: true, featured: true, sortOrder: 1 },
  { domain: 'youtube.com', name: 'YouTube', category: 'streaming', iconUrl: 'https://www.youtube.com/s/desktop/b4e90557/img/favicon_32x32.png', description: 'Video streaming', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { feed: '#contents', searchBox: 'input#search' }, safe: true, featured: true, sortOrder: 2 },
  { domain: 'disneyplus.com', name: 'Disney+', category: 'streaming', iconUrl: 'https://static-assets.bamgrid.com/product/disneyplus/favicons/favicon-32x32.png', description: 'Disney streaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 3 },
  { domain: 'hbomax.com', name: 'Max', category: 'streaming', iconUrl: 'https://play.max.com/favicon.ico', description: 'HBO Max streaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 4 },
  { domain: 'primevideo.com', name: 'Prime Video', category: 'streaming', iconUrl: 'https://m.media-amazon.com/images/G/01/digital/video/avod/AV_favicon_1.png', description: 'Amazon streaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 5 },
  { domain: 'hulu.com', name: 'Hulu', category: 'streaming', iconUrl: 'https://www.hulu.com/favicon.ico', description: 'Hulu streaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 6 },
  { domain: 'peacocktv.com', name: 'Peacock', category: 'streaming', iconUrl: 'https://www.peacocktv.com/favicon.ico', description: 'NBC streaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'paramountplus.com', name: 'Paramount+', category: 'streaming', iconUrl: 'https://www.paramountplus.com/favicon.ico', description: 'CBS streaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
  { domain: 'spotify.com', name: 'Spotify', category: 'streaming', iconUrl: 'https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png', description: 'Music streaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 9 },
  { domain: 'music.apple.com', name: 'Apple Music', category: 'streaming', iconUrl: 'https://music.apple.com/favicon.ico', description: 'Apple music', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 10 },
  { domain: 'twitch.tv', name: 'Twitch', category: 'streaming', iconUrl: 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png', description: 'Live streaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 11 },
  { domain: 'crunchyroll.com', name: 'Crunchyroll', category: 'streaming', iconUrl: 'https://www.crunchyroll.com/build/assets/img/favicons/favicon-32x32.png', description: 'Anime streaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 12 },
  { domain: 'soundcloud.com', name: 'SoundCloud', category: 'streaming', iconUrl: 'https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico', description: 'Music platform', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 13 },
  { domain: 'pandora.com', name: 'Pandora', category: 'streaming', iconUrl: 'https://www.pandora.com/favicon.ico', description: 'Music radio', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 14 },
  { domain: 'tidal.com', name: 'Tidal', category: 'streaming', iconUrl: 'https://tidal.com/favicon.ico', description: 'HiFi music', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 15 },
];

export const BANKING_PROFILES: SiteProfileSeed[] = [
  { domain: 'chase.com', name: 'Chase', category: 'banking', iconUrl: 'https://www.chase.com/favicon.ico', description: 'Chase Bank', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], loginMacros: { type: 'credentials', steps: ['enter username', 'enter password', '2FA'] }, safe: true, featured: true, sortOrder: 1 },
  { domain: 'bankofamerica.com', name: 'Bank of America', category: 'banking', iconUrl: 'https://www.bankofamerica.com/favicon.ico', description: 'BofA banking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], loginMacros: { type: 'credentials', steps: ['sign in', '2FA'] }, safe: true, featured: true, sortOrder: 2 },
  { domain: 'wellsfargo.com', name: 'Wells Fargo', category: 'banking', iconUrl: 'https://www.wellsfargo.com/favicon.ico', description: 'Wells Fargo banking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 3 },
  { domain: 'citi.com', name: 'Citibank', category: 'banking', iconUrl: 'https://www.citi.com/favicon.ico', description: 'Citi banking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 4 },
  { domain: 'usbank.com', name: 'US Bank', category: 'banking', iconUrl: 'https://www.usbank.com/favicon.ico', description: 'US Bank', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 5 },
  { domain: 'capitalone.com', name: 'Capital One', category: 'banking', iconUrl: 'https://www.capitalone.com/favicon.ico', description: 'Capital One banking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 6 },
  { domain: 'discover.com', name: 'Discover', category: 'banking', iconUrl: 'https://www.discover.com/favicon.ico', description: 'Discover banking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'amex.com', name: 'American Express', category: 'banking', iconUrl: 'https://www.americanexpress.com/favicon.ico', description: 'Amex cards', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 8 },
  { domain: 'paypal.com', name: 'PayPal', category: 'banking', iconUrl: 'https://www.paypalobjects.com/webstatic/icon/pp32.png', description: 'PayPal payments', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 9 },
  { domain: 'venmo.com', name: 'Venmo', category: 'banking', iconUrl: 'https://venmo.com/favicon.ico', description: 'Venmo payments', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 10 },
  { domain: 'cash.app', name: 'Cash App', category: 'banking', iconUrl: 'https://cash.app/favicon.ico', description: 'Cash App payments', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 11 },
  { domain: 'zelle.com', name: 'Zelle', category: 'banking', iconUrl: 'https://www.zellepay.com/favicon.ico', description: 'Zelle payments', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 12 },
  { domain: 'ally.com', name: 'Ally Bank', category: 'banking', iconUrl: 'https://www.ally.com/favicon.ico', description: 'Ally online bank', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 13 },
  { domain: 'marcus.com', name: 'Marcus by Goldman Sachs', category: 'banking', iconUrl: 'https://www.marcus.com/favicon.ico', description: 'Marcus savings', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 14 },
  { domain: 'sofi.com', name: 'SoFi', category: 'banking', iconUrl: 'https://www.sofi.com/favicon.ico', description: 'SoFi banking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 15 },
  { domain: 'chime.com', name: 'Chime', category: 'banking', iconUrl: 'https://www.chime.com/favicon.ico', description: 'Chime banking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 16 },
  { domain: 'wise.com', name: 'Wise', category: 'banking', iconUrl: 'https://wise.com/favicon.ico', description: 'International transfers', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 17 },
  { domain: 'revolut.com', name: 'Revolut', category: 'banking', iconUrl: 'https://www.revolut.com/favicon.ico', description: 'Digital banking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 18 },
];

export const PRODUCTIVITY_PROFILES: SiteProfileSeed[] = [
  { domain: 'docs.google.com', name: 'Google Docs', category: 'productivity', iconUrl: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico', description: 'Document editing', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 1 },
  { domain: 'sheets.google.com', name: 'Google Sheets', category: 'productivity', iconUrl: 'https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico', description: 'Spreadsheets', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 2 },
  { domain: 'slides.google.com', name: 'Google Slides', category: 'productivity', iconUrl: 'https://ssl.gstatic.com/docs/presentations/images/favicon5.ico', description: 'Presentations', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 3 },
  { domain: 'drive.google.com', name: 'Google Drive', category: 'productivity', iconUrl: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png', description: 'Cloud storage', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 4 },
  { domain: 'calendar.google.com', name: 'Google Calendar', category: 'productivity', iconUrl: 'https://calendar.google.com/googlecalendar/images/favicon_v2014_32.ico', description: 'Calendar', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: true, sortOrder: 5 },
  { domain: 'notion.so', name: 'Notion', category: 'productivity', iconUrl: 'https://www.notion.so/images/favicon.ico', description: 'All-in-one workspace', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 6 },
  { domain: 'trello.com', name: 'Trello', category: 'productivity', iconUrl: 'https://trello.com/favicon.ico', description: 'Project boards', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 7 },
  { domain: 'asana.com', name: 'Asana', category: 'productivity', iconUrl: 'https://asana.com/favicon.ico', description: 'Project management', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
  { domain: 'monday.com', name: 'Monday.com', category: 'productivity', iconUrl: 'https://monday.com/favicon.ico', description: 'Work OS', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
  { domain: 'airtable.com', name: 'Airtable', category: 'productivity', iconUrl: 'https://airtable.com/favicon.ico', description: 'Database spreadsheet', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 10 },
  { domain: 'dropbox.com', name: 'Dropbox', category: 'productivity', iconUrl: 'https://www.dropbox.com/static/30168/images/favicon.ico', description: 'Cloud storage', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 11 },
  { domain: 'evernote.com', name: 'Evernote', category: 'productivity', iconUrl: 'https://www.evernote.com/favicon.ico', description: 'Note taking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 12 },
  { domain: 'todoist.com', name: 'Todoist', category: 'productivity', iconUrl: 'https://todoist.com/favicon.ico', description: 'Task management', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 13 },
  { domain: 'clickup.com', name: 'ClickUp', category: 'productivity', iconUrl: 'https://clickup.com/favicon.ico', description: 'Productivity platform', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 14 },
  { domain: 'office.com', name: 'Microsoft 365', category: 'productivity', iconUrl: 'https://res.cdn.office.net/officehub/bundles/favicon-c5b1f4b7.ico', description: 'Microsoft Office online', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 15 },
  { domain: 'figma.com', name: 'Figma', category: 'productivity', iconUrl: 'https://static.figma.com/app/icon/1/favicon.png', description: 'Design tool', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 16 },
  { domain: 'canva.com', name: 'Canva', category: 'productivity', iconUrl: 'https://www.canva.com/favicon.ico', description: 'Design platform', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 17 },
  { domain: 'miro.com', name: 'Miro', category: 'productivity', iconUrl: 'https://miro.com/favicon.ico', description: 'Whiteboard', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 18 },
];

export const SHOPPING_PROFILES: SiteProfileSeed[] = [
  { domain: 'amazon.com', name: 'Amazon', category: 'shopping', iconUrl: 'https://www.amazon.com/favicon.ico', description: 'Online shopping', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], selectorsJson: { cart: '#nav-cart', searchBox: '#twotabsearchtextbox' }, safe: true, featured: true, sortOrder: 1 },
  { domain: 'ebay.com', name: 'eBay', category: 'shopping', iconUrl: 'https://www.ebay.com/favicon.ico', description: 'Online auctions', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 2 },
  { domain: 'walmart.com', name: 'Walmart', category: 'shopping', iconUrl: 'https://www.walmart.com/favicon.ico', description: 'Retail shopping', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 3 },
  { domain: 'target.com', name: 'Target', category: 'shopping', iconUrl: 'https://www.target.com/favicon.ico', description: 'Target shopping', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 4 },
  { domain: 'bestbuy.com', name: 'Best Buy', category: 'shopping', iconUrl: 'https://www.bestbuy.com/favicon.ico', description: 'Electronics', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 5 },
  { domain: 'etsy.com', name: 'Etsy', category: 'shopping', iconUrl: 'https://www.etsy.com/favicon.ico', description: 'Handmade goods', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 6 },
  { domain: 'costco.com', name: 'Costco', category: 'shopping', iconUrl: 'https://www.costco.com/favicon.ico', description: 'Wholesale shopping', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'homedepot.com', name: 'Home Depot', category: 'shopping', iconUrl: 'https://www.homedepot.com/favicon.ico', description: 'Home improvement', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
  { domain: 'lowes.com', name: 'Lowes', category: 'shopping', iconUrl: 'https://www.lowes.com/favicon.ico', description: 'Home improvement', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
  { domain: 'wayfair.com', name: 'Wayfair', category: 'shopping', iconUrl: 'https://www.wayfair.com/favicon.ico', description: 'Furniture', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 10 },
  { domain: 'nike.com', name: 'Nike', category: 'shopping', iconUrl: 'https://www.nike.com/favicon.ico', description: 'Athletic wear', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 11 },
  { domain: 'adidas.com', name: 'Adidas', category: 'shopping', iconUrl: 'https://www.adidas.com/favicon.ico', description: 'Athletic wear', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 12 },
  { domain: 'apple.com', name: 'Apple Store', category: 'shopping', iconUrl: 'https://www.apple.com/favicon.ico', description: 'Apple products', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 13 },
  { domain: 'newegg.com', name: 'Newegg', category: 'shopping', iconUrl: 'https://www.newegg.com/favicon.ico', description: 'Computer parts', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 14 },
];

export const TRAVEL_PROFILES: SiteProfileSeed[] = [
  { domain: 'google.com/travel', name: 'Google Travel', category: 'travel', iconUrl: 'https://www.google.com/favicon.ico', description: 'Trip planning', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 1 },
  { domain: 'expedia.com', name: 'Expedia', category: 'travel', iconUrl: 'https://www.expedia.com/favicon.ico', description: 'Travel booking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 2 },
  { domain: 'booking.com', name: 'Booking.com', category: 'travel', iconUrl: 'https://www.booking.com/favicon.ico', description: 'Hotel booking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 3 },
  { domain: 'airbnb.com', name: 'Airbnb', category: 'travel', iconUrl: 'https://www.airbnb.com/favicon.ico', description: 'Vacation rentals', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 4 },
  { domain: 'kayak.com', name: 'Kayak', category: 'travel', iconUrl: 'https://www.kayak.com/favicon.ico', description: 'Travel search', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 5 },
  { domain: 'tripadvisor.com', name: 'TripAdvisor', category: 'travel', iconUrl: 'https://www.tripadvisor.com/favicon.ico', description: 'Travel reviews', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 6 },
  { domain: 'southwest.com', name: 'Southwest Airlines', category: 'travel', iconUrl: 'https://www.southwest.com/favicon.ico', description: 'Airline booking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'delta.com', name: 'Delta Airlines', category: 'travel', iconUrl: 'https://www.delta.com/favicon.ico', description: 'Airline booking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
  { domain: 'united.com', name: 'United Airlines', category: 'travel', iconUrl: 'https://www.united.com/favicon.ico', description: 'Airline booking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
  { domain: 'aa.com', name: 'American Airlines', category: 'travel', iconUrl: 'https://www.aa.com/favicon.ico', description: 'Airline booking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 10 },
  { domain: 'uber.com', name: 'Uber', category: 'travel', iconUrl: 'https://www.uber.com/favicon.ico', description: 'Ride sharing', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 11 },
  { domain: 'lyft.com', name: 'Lyft', category: 'travel', iconUrl: 'https://www.lyft.com/favicon.ico', description: 'Ride sharing', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 12 },
  { domain: 'vrbo.com', name: 'VRBO', category: 'travel', iconUrl: 'https://www.vrbo.com/favicon.ico', description: 'Vacation rentals', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 13 },
  { domain: 'hotels.com', name: 'Hotels.com', category: 'travel', iconUrl: 'https://www.hotels.com/favicon.ico', description: 'Hotel booking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 14 },
];

export const FOOD_PROFILES: SiteProfileSeed[] = [
  { domain: 'doordash.com', name: 'DoorDash', category: 'food', iconUrl: 'https://www.doordash.com/favicon.ico', description: 'Food delivery', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 1 },
  { domain: 'ubereats.com', name: 'Uber Eats', category: 'food', iconUrl: 'https://www.ubereats.com/favicon.ico', description: 'Food delivery', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 2 },
  { domain: 'grubhub.com', name: 'Grubhub', category: 'food', iconUrl: 'https://www.grubhub.com/favicon.ico', description: 'Food delivery', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 3 },
  { domain: 'instacart.com', name: 'Instacart', category: 'food', iconUrl: 'https://www.instacart.com/favicon.ico', description: 'Grocery delivery', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 4 },
  { domain: 'postmates.com', name: 'Postmates', category: 'food', iconUrl: 'https://www.postmates.com/favicon.ico', description: 'Food delivery', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 5 },
  { domain: 'seamless.com', name: 'Seamless', category: 'food', iconUrl: 'https://www.seamless.com/favicon.ico', description: 'Food delivery', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 6 },
  { domain: 'opentable.com', name: 'OpenTable', category: 'food', iconUrl: 'https://www.opentable.com/favicon.ico', description: 'Restaurant reservations', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'yelp.com', name: 'Yelp', category: 'food', iconUrl: 'https://www.yelp.com/favicon.ico', description: 'Restaurant reviews', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
  { domain: 'starbucks.com', name: 'Starbucks', category: 'food', iconUrl: 'https://www.starbucks.com/favicon.ico', description: 'Coffee ordering', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
  { domain: 'chipotle.com', name: 'Chipotle', category: 'food', iconUrl: 'https://www.chipotle.com/favicon.ico', description: 'Restaurant ordering', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 10 },
];

export const NEWS_PROFILES: SiteProfileSeed[] = [
  { domain: 'news.google.com', name: 'Google News', category: 'news', iconUrl: 'https://news.google.com/favicon.ico', description: 'News aggregator', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: true, sortOrder: 1 },
  { domain: 'nytimes.com', name: 'New York Times', category: 'news', iconUrl: 'https://www.nytimes.com/favicon.ico', description: 'News publication', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 2 },
  { domain: 'wsj.com', name: 'Wall Street Journal', category: 'news', iconUrl: 'https://www.wsj.com/favicon.ico', description: 'Business news', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 3 },
  { domain: 'washingtonpost.com', name: 'Washington Post', category: 'news', iconUrl: 'https://www.washingtonpost.com/favicon.ico', description: 'News publication', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 4 },
  { domain: 'cnn.com', name: 'CNN', category: 'news', iconUrl: 'https://www.cnn.com/favicon.ico', description: 'News network', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 5 },
  { domain: 'bbc.com', name: 'BBC', category: 'news', iconUrl: 'https://www.bbc.com/favicon.ico', description: 'World news', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 6 },
  { domain: 'reuters.com', name: 'Reuters', category: 'news', iconUrl: 'https://www.reuters.com/favicon.ico', description: 'News agency', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'bloomberg.com', name: 'Bloomberg', category: 'news', iconUrl: 'https://www.bloomberg.com/favicon.ico', description: 'Financial news', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 8 },
  { domain: 'techcrunch.com', name: 'TechCrunch', category: 'news', iconUrl: 'https://techcrunch.com/favicon.ico', description: 'Tech news', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
  { domain: 'theverge.com', name: 'The Verge', category: 'news', iconUrl: 'https://www.theverge.com/favicon.ico', description: 'Tech news', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 10 },
  { domain: 'wired.com', name: 'Wired', category: 'news', iconUrl: 'https://www.wired.com/favicon.ico', description: 'Tech magazine', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 11 },
  { domain: 'arstechnica.com', name: 'Ars Technica', category: 'news', iconUrl: 'https://arstechnica.com/favicon.ico', description: 'Tech news', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 12 },
];

export const DEVELOPER_PROFILES: SiteProfileSeed[] = [
  { domain: 'github.com', name: 'GitHub', category: 'developer', iconUrl: 'https://github.githubassets.com/favicons/favicon.png', description: 'Code hosting', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], selectorsJson: { repos: '[data-testid="repo-list"]' }, safe: true, featured: true, sortOrder: 1 },
  { domain: 'gitlab.com', name: 'GitLab', category: 'developer', iconUrl: 'https://about.gitlab.com/nuxt-images/ico/favicon.ico', description: 'DevOps platform', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 2 },
  { domain: 'bitbucket.org', name: 'Bitbucket', category: 'developer', iconUrl: 'https://bitbucket.org/favicon.ico', description: 'Code hosting', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 3 },
  { domain: 'stackoverflow.com', name: 'Stack Overflow', category: 'developer', iconUrl: 'https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico', description: 'Developer Q&A', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: true, sortOrder: 4 },
  { domain: 'replit.com', name: 'Replit', category: 'developer', iconUrl: 'https://replit.com/public/icons/favicon-32x32.png', description: 'Online IDE', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 5 },
  { domain: 'vercel.com', name: 'Vercel', category: 'developer', iconUrl: 'https://assets.vercel.com/image/upload/v1588805858/repositories/vercel/logo.png', description: 'Deployment platform', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 6 },
  { domain: 'netlify.com', name: 'Netlify', category: 'developer', iconUrl: 'https://www.netlify.com/favicon.ico', description: 'Web hosting', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'railway.app', name: 'Railway', category: 'developer', iconUrl: 'https://railway.app/favicon.ico', description: 'Infrastructure platform', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
  { domain: 'render.com', name: 'Render', category: 'developer', iconUrl: 'https://render.com/favicon.ico', description: 'Cloud hosting', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
  { domain: 'npm.js.com', name: 'npm', category: 'developer', iconUrl: 'https://static.npmjs.com/favicon.ico', description: 'Package registry', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 10 },
  { domain: 'codesandbox.io', name: 'CodeSandbox', category: 'developer', iconUrl: 'https://codesandbox.io/favicon.ico', description: 'Online IDE', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 11 },
  { domain: 'codepen.io', name: 'CodePen', category: 'developer', iconUrl: 'https://cpwebassets.codepen.io/assets/favicon/favicon-32x32.png', description: 'Code playground', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 12 },
  { domain: 'jsfiddle.net', name: 'JSFiddle', category: 'developer', iconUrl: 'https://jsfiddle.net/favicon.ico', description: 'Code playground', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 13 },
  { domain: 'aws.amazon.com', name: 'AWS Console', category: 'developer', iconUrl: 'https://aws.amazon.com/favicon.ico', description: 'Cloud services', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 14 },
  { domain: 'console.cloud.google.com', name: 'Google Cloud', category: 'developer', iconUrl: 'https://cloud.google.com/favicon.ico', description: 'Cloud platform', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 15 },
  { domain: 'portal.azure.com', name: 'Azure Portal', category: 'developer', iconUrl: 'https://portal.azure.com/favicon.ico', description: 'Microsoft cloud', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 16 },
];

export const CRYPTO_PROFILES: SiteProfileSeed[] = [
  { domain: 'coinbase.com', name: 'Coinbase', category: 'crypto', iconUrl: 'https://www.coinbase.com/favicon.ico', description: 'Crypto exchange', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 1 },
  { domain: 'binance.com', name: 'Binance', category: 'crypto', iconUrl: 'https://public.bnbstatic.com/static/images/common/favicon.ico', description: 'Crypto exchange', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 2 },
  { domain: 'kraken.com', name: 'Kraken', category: 'crypto', iconUrl: 'https://www.kraken.com/favicon.ico', description: 'Crypto exchange', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 3 },
  { domain: 'opensea.io', name: 'OpenSea', category: 'crypto', iconUrl: 'https://opensea.io/favicon.ico', description: 'NFT marketplace', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 4 },
  { domain: 'uniswap.org', name: 'Uniswap', category: 'crypto', iconUrl: 'https://uniswap.org/favicon.ico', description: 'DEX protocol', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 5 },
  { domain: 'etherscan.io', name: 'Etherscan', category: 'crypto', iconUrl: 'https://etherscan.io/images/favicon3.ico', description: 'Ethereum explorer', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: true, sortOrder: 6 },
  { domain: 'polygonscan.com', name: 'Polygonscan', category: 'crypto', iconUrl: 'https://polygonscan.com/images/favicon.ico', description: 'Polygon explorer', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'basescan.org', name: 'Basescan', category: 'crypto', iconUrl: 'https://basescan.org/images/favicon.ico', description: 'Base explorer', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: true, sortOrder: 8 },
  { domain: 'arbiscan.io', name: 'Arbiscan', category: 'crypto', iconUrl: 'https://arbiscan.io/images/favicon.ico', description: 'Arbitrum explorer', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
  { domain: 'solscan.io', name: 'Solscan', category: 'crypto', iconUrl: 'https://solscan.io/favicon.ico', description: 'Solana explorer', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 10 },
  { domain: 'metamask.io', name: 'MetaMask Portfolio', category: 'crypto', iconUrl: 'https://metamask.io/favicon.ico', description: 'Wallet portfolio', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 11 },
  { domain: 'rainbow.me', name: 'Rainbow', category: 'crypto', iconUrl: 'https://rainbow.me/favicon.ico', description: 'Wallet app', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 12 },
  { domain: 'zapper.xyz', name: 'Zapper', category: 'crypto', iconUrl: 'https://zapper.xyz/favicon.ico', description: 'DeFi dashboard', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 13 },
  { domain: 'debank.com', name: 'DeBank', category: 'crypto', iconUrl: 'https://debank.com/favicon.ico', description: 'DeFi portfolio', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 14 },
  { domain: 'dexscreener.com', name: 'DEX Screener', category: 'crypto', iconUrl: 'https://dexscreener.com/favicon.ico', description: 'DEX analytics', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 15 },
  { domain: 'coingecko.com', name: 'CoinGecko', category: 'crypto', iconUrl: 'https://www.coingecko.com/favicon.ico', description: 'Crypto prices', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: true, sortOrder: 16 },
  { domain: 'coinmarketcap.com', name: 'CoinMarketCap', category: 'crypto', iconUrl: 'https://coinmarketcap.com/favicon.ico', description: 'Crypto prices', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: false, sortOrder: 17 },
];

export const GOVERNMENT_PROFILES: SiteProfileSeed[] = [
  { domain: 'irs.gov', name: 'IRS', category: 'government', iconUrl: 'https://www.irs.gov/favicon.ico', description: 'Tax services', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 1 },
  { domain: 'ssa.gov', name: 'Social Security', category: 'government', iconUrl: 'https://www.ssa.gov/favicon.ico', description: 'Social Security Admin', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 2 },
  { domain: 'usps.com', name: 'USPS', category: 'government', iconUrl: 'https://www.usps.com/favicon.ico', description: 'Postal service', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 3 },
  { domain: 'dmv.gov', name: 'DMV', category: 'government', iconUrl: 'https://www.dmv.ca.gov/portal/favicon.ico', description: 'Motor vehicles', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 4 },
  { domain: 'usa.gov', name: 'USA.gov', category: 'government', iconUrl: 'https://www.usa.gov/favicon.ico', description: 'Government portal', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 5 },
  { domain: 'login.gov', name: 'Login.gov', category: 'government', iconUrl: 'https://login.gov/favicon.ico', description: 'Gov identity', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 6 },
  { domain: 'id.me', name: 'ID.me', category: 'government', iconUrl: 'https://www.id.me/favicon.ico', description: 'Identity verification', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
];

export const HEALTH_PROFILES: SiteProfileSeed[] = [
  { domain: 'myuhc.com', name: 'UnitedHealthcare', category: 'health', iconUrl: 'https://www.myuhc.com/favicon.ico', description: 'Health insurance', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 1 },
  { domain: 'anthem.com', name: 'Anthem', category: 'health', iconUrl: 'https://www.anthem.com/favicon.ico', description: 'Health insurance', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 2 },
  { domain: 'cigna.com', name: 'Cigna', category: 'health', iconUrl: 'https://www.cigna.com/favicon.ico', description: 'Health insurance', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 3 },
  { domain: 'aetna.com', name: 'Aetna', category: 'health', iconUrl: 'https://www.aetna.com/favicon.ico', description: 'Health insurance', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 4 },
  { domain: 'mychart.com', name: 'MyChart', category: 'health', iconUrl: 'https://www.mychart.com/favicon.ico', description: 'Patient portal', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 5 },
  { domain: 'cvs.com', name: 'CVS', category: 'health', iconUrl: 'https://www.cvs.com/favicon.ico', description: 'Pharmacy', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 6 },
  { domain: 'walgreens.com', name: 'Walgreens', category: 'health', iconUrl: 'https://www.walgreens.com/favicon.ico', description: 'Pharmacy', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'zocdoc.com', name: 'Zocdoc', category: 'health', iconUrl: 'https://www.zocdoc.com/favicon.ico', description: 'Doctor booking', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
];

export const FINANCE_PROFILES: SiteProfileSeed[] = [
  { domain: 'robinhood.com', name: 'Robinhood', category: 'finance', iconUrl: 'https://robinhood.com/favicon.ico', description: 'Stock trading', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 1 },
  { domain: 'fidelity.com', name: 'Fidelity', category: 'finance', iconUrl: 'https://www.fidelity.com/favicon.ico', description: 'Investment services', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 2 },
  { domain: 'schwab.com', name: 'Charles Schwab', category: 'finance', iconUrl: 'https://www.schwab.com/favicon.ico', description: 'Brokerage', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 3 },
  { domain: 'vanguard.com', name: 'Vanguard', category: 'finance', iconUrl: 'https://www.vanguard.com/favicon.ico', description: 'Investment services', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 4 },
  { domain: 'etrade.com', name: 'E*TRADE', category: 'finance', iconUrl: 'https://www.etrade.com/favicon.ico', description: 'Online trading', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 5 },
  { domain: 'tdameritrade.com', name: 'TD Ameritrade', category: 'finance', iconUrl: 'https://www.tdameritrade.com/favicon.ico', description: 'Trading platform', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 6 },
  { domain: 'mint.intuit.com', name: 'Mint', category: 'finance', iconUrl: 'https://mint.intuit.com/favicon.ico', description: 'Budgeting', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'personalcapital.com', name: 'Empower', category: 'finance', iconUrl: 'https://www.personalcapital.com/favicon.ico', description: 'Wealth management', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
  { domain: 'betterment.com', name: 'Betterment', category: 'finance', iconUrl: 'https://www.betterment.com/favicon.ico', description: 'Robo-advisor', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
  { domain: 'wealthfront.com', name: 'Wealthfront', category: 'finance', iconUrl: 'https://www.wealthfront.com/favicon.ico', description: 'Robo-advisor', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 10 },
  { domain: 'creditkarma.com', name: 'Credit Karma', category: 'finance', iconUrl: 'https://www.creditkarma.com/favicon.ico', description: 'Credit monitoring', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 11 },
  { domain: 'experian.com', name: 'Experian', category: 'finance', iconUrl: 'https://www.experian.com/favicon.ico', description: 'Credit bureau', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 12 },
  { domain: 'equifax.com', name: 'Equifax', category: 'finance', iconUrl: 'https://www.equifax.com/favicon.ico', description: 'Credit bureau', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 13 },
  { domain: 'transunion.com', name: 'TransUnion', category: 'finance', iconUrl: 'https://www.transunion.com/favicon.ico', description: 'Credit bureau', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 14 },
  { domain: 'turbotax.intuit.com', name: 'TurboTax', category: 'finance', iconUrl: 'https://turbotax.intuit.com/favicon.ico', description: 'Tax preparation', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 15 },
];

export const EDUCATION_PROFILES: SiteProfileSeed[] = [
  { domain: 'coursera.org', name: 'Coursera', category: 'education', iconUrl: 'https://d3njjcbhbojbot.cloudfront.net/web/images/favicons/favicon-32x32.png', description: 'Online courses', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 1 },
  { domain: 'udemy.com', name: 'Udemy', category: 'education', iconUrl: 'https://www.udemy.com/staticx/udemy/images/v8/favicon-32x32.png', description: 'Online courses', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 2 },
  { domain: 'edx.org', name: 'edX', category: 'education', iconUrl: 'https://www.edx.org/favicon.ico', description: 'Online courses', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 3 },
  { domain: 'khanacademy.org', name: 'Khan Academy', category: 'education', iconUrl: 'https://cdn.kastatic.org/images/favicon.ico', description: 'Free education', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 4 },
  { domain: 'linkedin.com/learning', name: 'LinkedIn Learning', category: 'education', iconUrl: 'https://static.licdn.com/aero-v1/sc/h/al2o9zrvru7aqj8e1x2rzsrca', description: 'Professional courses', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 5 },
  { domain: 'skillshare.com', name: 'Skillshare', category: 'education', iconUrl: 'https://www.skillshare.com/favicon.ico', description: 'Creative classes', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 6 },
  { domain: 'duolingo.com', name: 'Duolingo', category: 'education', iconUrl: 'https://www.duolingo.com/favicon.ico', description: 'Language learning', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 7 },
  { domain: 'quizlet.com', name: 'Quizlet', category: 'education', iconUrl: 'https://quizlet.com/favicon.ico', description: 'Flashcards', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
  { domain: 'chegg.com', name: 'Chegg', category: 'education', iconUrl: 'https://www.chegg.com/favicon.ico', description: 'Study help', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
  { domain: 'wikipedia.org', name: 'Wikipedia', category: 'education', iconUrl: 'https://en.wikipedia.org/static/favicon/wikipedia.ico', description: 'Encyclopedia', defaultActions: ['navigate', 'refresh', 'scrape', 'capture', 'signout'], safe: true, featured: true, sortOrder: 10 },
];

export const GAMING_PROFILES: SiteProfileSeed[] = [
  { domain: 'store.steampowered.com', name: 'Steam', category: 'gaming', iconUrl: 'https://store.steampowered.com/favicon.ico', description: 'Gaming platform', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 1 },
  { domain: 'epicgames.com', name: 'Epic Games', category: 'gaming', iconUrl: 'https://www.epicgames.com/favicon.ico', description: 'Gaming platform', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: true, sortOrder: 2 },
  { domain: 'xbox.com', name: 'Xbox', category: 'gaming', iconUrl: 'https://www.xbox.com/favicon.ico', description: 'Xbox gaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 3 },
  { domain: 'playstation.com', name: 'PlayStation', category: 'gaming', iconUrl: 'https://www.playstation.com/favicon.ico', description: 'PlayStation gaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 4 },
  { domain: 'nintendo.com', name: 'Nintendo', category: 'gaming', iconUrl: 'https://www.nintendo.com/favicon.ico', description: 'Nintendo gaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 5 },
  { domain: 'roblox.com', name: 'Roblox', category: 'gaming', iconUrl: 'https://www.roblox.com/favicon.ico', description: 'Gaming platform', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 6 },
  { domain: 'ea.com', name: 'EA', category: 'gaming', iconUrl: 'https://www.ea.com/favicon.ico', description: 'EA games', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 7 },
  { domain: 'battle.net', name: 'Battle.net', category: 'gaming', iconUrl: 'https://us.battle.net/favicon.ico', description: 'Blizzard gaming', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 8 },
  { domain: 'ign.com', name: 'IGN', category: 'gaming', iconUrl: 'https://www.ign.com/favicon.ico', description: 'Gaming news', defaultActions: ['navigate', 'refresh', 'capture', 'signout'], safe: true, featured: false, sortOrder: 9 },
];

export const ALL_PROFILES: SiteProfileSeed[] = [
  ...MESSAGING_PROFILES,
  ...SOCIAL_PROFILES,
  ...EMAIL_PROFILES,
  ...STREAMING_PROFILES,
  ...BANKING_PROFILES,
  ...PRODUCTIVITY_PROFILES,
  ...SHOPPING_PROFILES,
  ...TRAVEL_PROFILES,
  ...FOOD_PROFILES,
  ...NEWS_PROFILES,
  ...DEVELOPER_PROFILES,
  ...CRYPTO_PROFILES,
  ...GOVERNMENT_PROFILES,
  ...HEALTH_PROFILES,
  ...FINANCE_PROFILES,
  ...EDUCATION_PROFILES,
  ...GAMING_PROFILES,
];

export const PROFILES_BY_CATEGORY: Record<string, SiteProfileSeed[]> = {
  messaging: MESSAGING_PROFILES,
  social: SOCIAL_PROFILES,
  email: EMAIL_PROFILES,
  streaming: STREAMING_PROFILES,
  banking: BANKING_PROFILES,
  productivity: PRODUCTIVITY_PROFILES,
  shopping: SHOPPING_PROFILES,
  travel: TRAVEL_PROFILES,
  food: FOOD_PROFILES,
  news: NEWS_PROFILES,
  developer: DEVELOPER_PROFILES,
  crypto: CRYPTO_PROFILES,
  government: GOVERNMENT_PROFILES,
  health: HEALTH_PROFILES,
  finance: FINANCE_PROFILES,
  education: EDUCATION_PROFILES,
  gaming: GAMING_PROFILES,
};

export const CATEGORY_DISPLAY_ORDER = [
  'messaging', 'social', 'email', 'streaming', 'banking', 'productivity',
  'shopping', 'finance', 'crypto', 'developer', 'travel', 'food',
  'news', 'health', 'education', 'gaming', 'government', 'other'
];
