export type IntentType = 
  | 'openApp'
  | 'playMedia'
  | 'searchApp'
  | 'sendMessage'
  | 'callContact'
  | 'emailContact'
  | 'navigateTo'
  | 'bookRide'
  | 'orderFood'
  | 'searchFile'
  | 'searchProfile';

export type AppCategory = 
  | 'messaging'
  | 'music'
  | 'video'
  | 'navigation'
  | 'shopping'
  | 'social'
  | 'productivity'
  | 'finance';

export interface DeepLink {
  ios: string;
  android: string;
  web: string;
}

export interface AppIntent {
  utterancePattern: string;
  intentType: IntentType;
  deepLink: DeepLink;
}

export interface AppManifest {
  id: string;
  name: string;
  icon: string;
  category: AppCategory;
  intents: AppIntent[];
}

export const deepLinkManifest: AppManifest[] = [
  // ============================================
  // MESSAGING APPS
  // ============================================
  {
    id: 'sms',
    name: 'Messages',
    icon: '💬',
    category: 'messaging',
    intents: [
      {
        utterancePattern: 'send text to [contact]',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'sms:[number]',
          android: 'sms:[number]',
          web: 'sms:[number]'
        }
      },
      {
        utterancePattern: 'text [contact]',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'sms:[number]&body=[message]',
          android: 'sms:[number]?body=[message]',
          web: 'sms:[number]?body=[message]'
        }
      },
      {
        utterancePattern: 'open messages',
        intentType: 'openApp',
        deepLink: {
          ios: 'sms:',
          android: 'sms:',
          web: 'https://messages.google.com'
        }
      }
    ]
  },
  {
    id: 'phone',
    name: 'Phone',
    icon: '📞',
    category: 'messaging',
    intents: [
      {
        utterancePattern: 'call [contact]',
        intentType: 'callContact',
        deepLink: {
          ios: 'tel:[number]',
          android: 'tel:[number]',
          web: 'tel:[number]'
        }
      },
      {
        utterancePattern: 'phone [contact]',
        intentType: 'callContact',
        deepLink: {
          ios: 'tel:[number]',
          android: 'tel:[number]',
          web: 'tel:[number]'
        }
      },
      {
        utterancePattern: 'dial [number]',
        intentType: 'callContact',
        deepLink: {
          ios: 'tel:[number]',
          android: 'tel:[number]',
          web: 'tel:[number]'
        }
      },
      {
        utterancePattern: 'open phone',
        intentType: 'openApp',
        deepLink: {
          ios: 'tel:',
          android: 'tel:',
          web: 'tel:'
        }
      }
    ]
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '📱',
    category: 'messaging',
    intents: [
      {
        utterancePattern: 'send whatsapp to [contact]',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'whatsapp://send?phone=[number]',
          android: 'whatsapp://send?phone=[number]',
          web: 'https://wa.me/[number]'
        }
      },
      {
        utterancePattern: 'whatsapp [contact]',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'whatsapp://send?phone=[number]&text=[message]',
          android: 'whatsapp://send?phone=[number]&text=[message]',
          web: 'https://wa.me/[number]?text=[message]'
        }
      },
      {
        utterancePattern: 'open whatsapp',
        intentType: 'openApp',
        deepLink: {
          ios: 'whatsapp://',
          android: 'whatsapp://',
          web: 'https://web.whatsapp.com'
        }
      },
      {
        utterancePattern: 'call on whatsapp',
        intentType: 'callContact',
        deepLink: {
          ios: 'whatsapp://call?phone=[number]',
          android: 'whatsapp://call?phone=[number]',
          web: 'https://wa.me/[number]'
        }
      }
    ]
  },
  {
    id: 'messenger',
    name: 'Messenger',
    icon: '💭',
    category: 'messaging',
    intents: [
      {
        utterancePattern: 'send messenger to [contact]',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'fb-messenger://user-thread/[userId]',
          android: 'fb-messenger://user-thread/[userId]',
          web: 'https://www.messenger.com/t/[userId]'
        }
      },
      {
        utterancePattern: 'message on messenger',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'fb-messenger://share?link=[url]',
          android: 'fb-messenger://share?link=[url]',
          web: 'https://www.messenger.com'
        }
      },
      {
        utterancePattern: 'open messenger',
        intentType: 'openApp',
        deepLink: {
          ios: 'fb-messenger://',
          android: 'fb-messenger://',
          web: 'https://www.messenger.com'
        }
      }
    ]
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💼',
    category: 'messaging',
    intents: [
      {
        utterancePattern: 'send slack message',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'slack://channel?team=[teamId]&id=[channelId]',
          android: 'slack://channel?team=[teamId]&id=[channelId]',
          web: 'https://app.slack.com/client/[teamId]/[channelId]'
        }
      },
      {
        utterancePattern: 'open slack channel',
        intentType: 'openApp',
        deepLink: {
          ios: 'slack://open?team=[teamId]',
          android: 'slack://open?team=[teamId]',
          web: 'https://app.slack.com'
        }
      },
      {
        utterancePattern: 'search slack for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'slack://search?query=[query]',
          android: 'slack://search?query=[query]',
          web: 'https://app.slack.com/search'
        }
      }
    ]
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    category: 'messaging',
    intents: [
      {
        utterancePattern: 'open discord',
        intentType: 'openApp',
        deepLink: {
          ios: 'discord://',
          android: 'discord://',
          web: 'https://discord.com/app'
        }
      },
      {
        utterancePattern: 'join discord server',
        intentType: 'openApp',
        deepLink: {
          ios: 'discord://discord.gg/[inviteCode]',
          android: 'discord://discord.gg/[inviteCode]',
          web: 'https://discord.gg/[inviteCode]'
        }
      },
      {
        utterancePattern: 'message on discord',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'discord://channels/[guildId]/[channelId]',
          android: 'discord://channels/[guildId]/[channelId]',
          web: 'https://discord.com/channels/[guildId]/[channelId]'
        }
      }
    ]
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    category: 'messaging',
    intents: [
      {
        utterancePattern: 'send telegram to [contact]',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'tg://msg?to=[username]&text=[message]',
          android: 'tg://msg?to=[username]&text=[message]',
          web: 'https://t.me/[username]'
        }
      },
      {
        utterancePattern: 'open telegram',
        intentType: 'openApp',
        deepLink: {
          ios: 'tg://',
          android: 'tg://',
          web: 'https://web.telegram.org'
        }
      },
      {
        utterancePattern: 'telegram [contact]',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'tg://resolve?domain=[username]',
          android: 'tg://resolve?domain=[username]',
          web: 'https://t.me/[username]'
        }
      }
    ]
  },
  {
    id: 'signal',
    name: 'Signal',
    icon: '🔐',
    category: 'messaging',
    intents: [
      {
        utterancePattern: 'send signal message',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'sgnl://signal.me/#p/[number]',
          android: 'sgnl://signal.me/#p/[number]',
          web: 'https://signal.me/#p/[number]'
        }
      },
      {
        utterancePattern: 'open signal',
        intentType: 'openApp',
        deepLink: {
          ios: 'sgnl://',
          android: 'sgnl://',
          web: 'https://signal.org'
        }
      }
    ]
  },

  // ============================================
  // MUSIC APPS
  // ============================================
  {
    id: 'spotify',
    name: 'Spotify',
    icon: '🎵',
    category: 'music',
    intents: [
      {
        utterancePattern: 'play [song] on spotify',
        intentType: 'playMedia',
        deepLink: {
          ios: 'spotify://search/[query]',
          android: 'spotify://search/[query]',
          web: 'https://open.spotify.com/search/[query]'
        }
      },
      {
        utterancePattern: 'search spotify for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'spotify://search/[query]',
          android: 'spotify://search/[query]',
          web: 'https://open.spotify.com/search/[query]'
        }
      },
      {
        utterancePattern: 'open spotify',
        intentType: 'openApp',
        deepLink: {
          ios: 'spotify://',
          android: 'spotify://',
          web: 'https://open.spotify.com'
        }
      },
      {
        utterancePattern: 'play spotify playlist',
        intentType: 'playMedia',
        deepLink: {
          ios: 'spotify://playlist/[playlistId]',
          android: 'spotify://playlist/[playlistId]',
          web: 'https://open.spotify.com/playlist/[playlistId]'
        }
      },
      {
        utterancePattern: 'play artist on spotify',
        intentType: 'playMedia',
        deepLink: {
          ios: 'spotify://artist/[artistId]',
          android: 'spotify://artist/[artistId]',
          web: 'https://open.spotify.com/artist/[artistId]'
        }
      }
    ]
  },
  {
    id: 'pandora',
    name: 'Pandora',
    icon: '📻',
    category: 'music',
    intents: [
      {
        utterancePattern: 'play pandora',
        intentType: 'playMedia',
        deepLink: {
          ios: 'pandora://',
          android: 'pandora://',
          web: 'https://www.pandora.com'
        }
      },
      {
        utterancePattern: 'search pandora for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'pandora://search?query=[query]',
          android: 'pandora://search?query=[query]',
          web: 'https://www.pandora.com/search/[query]'
        }
      },
      {
        utterancePattern: 'open pandora',
        intentType: 'openApp',
        deepLink: {
          ios: 'pandora://',
          android: 'pandora://',
          web: 'https://www.pandora.com'
        }
      }
    ]
  },
  {
    id: 'apple-music',
    name: 'Apple Music',
    icon: '🍎',
    category: 'music',
    intents: [
      {
        utterancePattern: 'play on apple music',
        intentType: 'playMedia',
        deepLink: {
          ios: 'music://music.apple.com/search?term=[query]',
          android: 'intent://music.apple.com/search?term=[query]#Intent;scheme=https;package=com.apple.android.music;end',
          web: 'https://music.apple.com/search?term=[query]'
        }
      },
      {
        utterancePattern: 'search apple music for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'music://music.apple.com/search?term=[query]',
          android: 'https://music.apple.com/search?term=[query]',
          web: 'https://music.apple.com/search?term=[query]'
        }
      },
      {
        utterancePattern: 'open apple music',
        intentType: 'openApp',
        deepLink: {
          ios: 'music://',
          android: 'https://music.apple.com',
          web: 'https://music.apple.com'
        }
      }
    ]
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    icon: '☁️',
    category: 'music',
    intents: [
      {
        utterancePattern: 'play on soundcloud',
        intentType: 'playMedia',
        deepLink: {
          ios: 'soundcloud://search?q=[query]',
          android: 'soundcloud://search?q=[query]',
          web: 'https://soundcloud.com/search?q=[query]'
        }
      },
      {
        utterancePattern: 'search soundcloud for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'soundcloud://search?q=[query]',
          android: 'soundcloud://search?q=[query]',
          web: 'https://soundcloud.com/search?q=[query]'
        }
      },
      {
        utterancePattern: 'open soundcloud',
        intentType: 'openApp',
        deepLink: {
          ios: 'soundcloud://',
          android: 'soundcloud://',
          web: 'https://soundcloud.com'
        }
      }
    ]
  },
  {
    id: 'shazam',
    name: 'Shazam',
    icon: '🎤',
    category: 'music',
    intents: [
      {
        utterancePattern: 'shazam this song',
        intentType: 'searchApp',
        deepLink: {
          ios: 'shazam://recognize',
          android: 'shazam://recognize',
          web: 'https://www.shazam.com'
        }
      },
      {
        utterancePattern: 'open shazam',
        intentType: 'openApp',
        deepLink: {
          ios: 'shazam://',
          android: 'shazam://',
          web: 'https://www.shazam.com'
        }
      },
      {
        utterancePattern: 'what song is this',
        intentType: 'searchApp',
        deepLink: {
          ios: 'shazam://recognize',
          android: 'shazam://recognize',
          web: 'https://www.shazam.com'
        }
      }
    ]
  },

  // ============================================
  // VIDEO APPS
  // ============================================
  {
    id: 'netflix',
    name: 'Netflix',
    icon: '🎬',
    category: 'video',
    intents: [
      {
        utterancePattern: 'watch on netflix',
        intentType: 'playMedia',
        deepLink: {
          ios: 'nflx://www.netflix.com/title/[titleId]',
          android: 'nflx://www.netflix.com/title/[titleId]',
          web: 'https://www.netflix.com/title/[titleId]'
        }
      },
      {
        utterancePattern: 'search netflix for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'nflx://www.netflix.com/search?q=[query]',
          android: 'nflx://www.netflix.com/search?q=[query]',
          web: 'https://www.netflix.com/search?q=[query]'
        }
      },
      {
        utterancePattern: 'open netflix',
        intentType: 'openApp',
        deepLink: {
          ios: 'nflx://',
          android: 'nflx://',
          web: 'https://www.netflix.com'
        }
      }
    ]
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶️',
    category: 'video',
    intents: [
      {
        utterancePattern: 'watch on youtube',
        intentType: 'playMedia',
        deepLink: {
          ios: 'youtube://www.youtube.com/watch?v=[videoId]',
          android: 'vnd.youtube:[videoId]',
          web: 'https://www.youtube.com/watch?v=[videoId]'
        }
      },
      {
        utterancePattern: 'search youtube for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'youtube://www.youtube.com/results?search_query=[query]',
          android: 'vnd.youtube://results?search_query=[query]',
          web: 'https://www.youtube.com/results?search_query=[query]'
        }
      },
      {
        utterancePattern: 'open youtube',
        intentType: 'openApp',
        deepLink: {
          ios: 'youtube://',
          android: 'vnd.youtube://',
          web: 'https://www.youtube.com'
        }
      },
      {
        utterancePattern: 'youtube channel',
        intentType: 'searchProfile',
        deepLink: {
          ios: 'youtube://www.youtube.com/c/[channelName]',
          android: 'vnd.youtube://c/[channelName]',
          web: 'https://www.youtube.com/c/[channelName]'
        }
      }
    ]
  },
  {
    id: 'hulu',
    name: 'Hulu',
    icon: '📺',
    category: 'video',
    intents: [
      {
        utterancePattern: 'watch on hulu',
        intentType: 'playMedia',
        deepLink: {
          ios: 'hulu://watch/[contentId]',
          android: 'hulu://watch/[contentId]',
          web: 'https://www.hulu.com/watch/[contentId]'
        }
      },
      {
        utterancePattern: 'search hulu for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'hulu://search?query=[query]',
          android: 'hulu://search?query=[query]',
          web: 'https://www.hulu.com/search?q=[query]'
        }
      },
      {
        utterancePattern: 'open hulu',
        intentType: 'openApp',
        deepLink: {
          ios: 'hulu://',
          android: 'hulu://',
          web: 'https://www.hulu.com'
        }
      }
    ]
  },
  {
    id: 'disney-plus',
    name: 'Disney+',
    icon: '🏰',
    category: 'video',
    intents: [
      {
        utterancePattern: 'watch on disney plus',
        intentType: 'playMedia',
        deepLink: {
          ios: 'disneyplus://video/[contentId]',
          android: 'disneyplus://video/[contentId]',
          web: 'https://www.disneyplus.com/video/[contentId]'
        }
      },
      {
        utterancePattern: 'search disney plus for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'disneyplus://search?q=[query]',
          android: 'disneyplus://search?q=[query]',
          web: 'https://www.disneyplus.com/search?q=[query]'
        }
      },
      {
        utterancePattern: 'open disney plus',
        intentType: 'openApp',
        deepLink: {
          ios: 'disneyplus://',
          android: 'disneyplus://',
          web: 'https://www.disneyplus.com'
        }
      }
    ]
  },
  {
    id: 'prime-video',
    name: 'Prime Video',
    icon: '🎭',
    category: 'video',
    intents: [
      {
        utterancePattern: 'watch on prime video',
        intentType: 'playMedia',
        deepLink: {
          ios: 'aiv://aiv/play?asin=[asin]',
          android: 'intent://watch/[asin]#Intent;scheme=aiv;package=com.amazon.avod.thirdpartyclient;end',
          web: 'https://www.primevideo.com/detail/[asin]'
        }
      },
      {
        utterancePattern: 'search prime video for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'aiv://aiv/search?phrase=[query]',
          android: 'aiv://aiv/search?phrase=[query]',
          web: 'https://www.primevideo.com/search?phrase=[query]'
        }
      },
      {
        utterancePattern: 'open prime video',
        intentType: 'openApp',
        deepLink: {
          ios: 'aiv://',
          android: 'aiv://',
          web: 'https://www.primevideo.com'
        }
      }
    ]
  },
  {
    id: 'twitch',
    name: 'Twitch',
    icon: '🎮',
    category: 'video',
    intents: [
      {
        utterancePattern: 'watch on twitch',
        intentType: 'playMedia',
        deepLink: {
          ios: 'twitch://stream/[channelName]',
          android: 'twitch://stream/[channelName]',
          web: 'https://www.twitch.tv/[channelName]'
        }
      },
      {
        utterancePattern: 'search twitch for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'twitch://search?query=[query]',
          android: 'twitch://search?query=[query]',
          web: 'https://www.twitch.tv/search?term=[query]'
        }
      },
      {
        utterancePattern: 'open twitch',
        intentType: 'openApp',
        deepLink: {
          ios: 'twitch://',
          android: 'twitch://',
          web: 'https://www.twitch.tv'
        }
      }
    ]
  },

  // ============================================
  // NAVIGATION APPS
  // ============================================
  {
    id: 'google-maps',
    name: 'Google Maps',
    icon: '🗺️',
    category: 'navigation',
    intents: [
      {
        utterancePattern: 'navigate to [destination]',
        intentType: 'navigateTo',
        deepLink: {
          ios: 'comgooglemaps://?daddr=[destination]&directionsmode=driving',
          android: 'google.navigation:q=[destination]',
          web: 'https://www.google.com/maps/dir/?api=1&destination=[destination]'
        }
      },
      {
        utterancePattern: 'search maps for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'comgooglemaps://?q=[query]',
          android: 'geo:0,0?q=[query]',
          web: 'https://www.google.com/maps/search/[query]'
        }
      },
      {
        utterancePattern: 'open google maps',
        intentType: 'openApp',
        deepLink: {
          ios: 'comgooglemaps://',
          android: 'geo:0,0',
          web: 'https://www.google.com/maps'
        }
      },
      {
        utterancePattern: 'directions to [destination]',
        intentType: 'navigateTo',
        deepLink: {
          ios: 'comgooglemaps://?daddr=[destination]',
          android: 'google.navigation:q=[destination]',
          web: 'https://www.google.com/maps/dir/?api=1&destination=[destination]'
        }
      }
    ]
  },
  {
    id: 'apple-maps',
    name: 'Apple Maps',
    icon: '🧭',
    category: 'navigation',
    intents: [
      {
        utterancePattern: 'navigate with apple maps',
        intentType: 'navigateTo',
        deepLink: {
          ios: 'maps://?daddr=[destination]',
          android: 'https://maps.apple.com/?daddr=[destination]',
          web: 'https://maps.apple.com/?daddr=[destination]'
        }
      },
      {
        utterancePattern: 'search apple maps for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'maps://?q=[query]',
          android: 'https://maps.apple.com/?q=[query]',
          web: 'https://maps.apple.com/?q=[query]'
        }
      },
      {
        utterancePattern: 'open apple maps',
        intentType: 'openApp',
        deepLink: {
          ios: 'maps://',
          android: 'https://maps.apple.com',
          web: 'https://maps.apple.com'
        }
      }
    ]
  },
  {
    id: 'waze',
    name: 'Waze',
    icon: '🚗',
    category: 'navigation',
    intents: [
      {
        utterancePattern: 'navigate with waze',
        intentType: 'navigateTo',
        deepLink: {
          ios: 'waze://?q=[destination]&navigate=yes',
          android: 'waze://?q=[destination]&navigate=yes',
          web: 'https://waze.com/ul?q=[destination]&navigate=yes'
        }
      },
      {
        utterancePattern: 'search waze for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'waze://?q=[query]',
          android: 'waze://?q=[query]',
          web: 'https://waze.com/ul?q=[query]'
        }
      },
      {
        utterancePattern: 'open waze',
        intentType: 'openApp',
        deepLink: {
          ios: 'waze://',
          android: 'waze://',
          web: 'https://www.waze.com'
        }
      }
    ]
  },
  {
    id: 'uber',
    name: 'Uber',
    icon: '🚕',
    category: 'navigation',
    intents: [
      {
        utterancePattern: 'book uber to [destination]',
        intentType: 'bookRide',
        deepLink: {
          ios: 'uber://?action=setPickup&dropoff[formatted_address]=[destination]',
          android: 'uber://?action=setPickup&dropoff[formatted_address]=[destination]',
          web: 'https://m.uber.com/ul/?action=setPickup&dropoff[formatted_address]=[destination]'
        }
      },
      {
        utterancePattern: 'get uber ride',
        intentType: 'bookRide',
        deepLink: {
          ios: 'uber://?action=setPickup&pickup=my_location',
          android: 'uber://?action=setPickup&pickup=my_location',
          web: 'https://m.uber.com/ul/'
        }
      },
      {
        utterancePattern: 'open uber',
        intentType: 'openApp',
        deepLink: {
          ios: 'uber://',
          android: 'uber://',
          web: 'https://m.uber.com'
        }
      }
    ]
  },
  {
    id: 'lyft',
    name: 'Lyft',
    icon: '🚙',
    category: 'navigation',
    intents: [
      {
        utterancePattern: 'book lyft to [destination]',
        intentType: 'bookRide',
        deepLink: {
          ios: 'lyft://ridetype?id=lyft&destination[address]=[destination]',
          android: 'lyft://ridetype?id=lyft&destination[address]=[destination]',
          web: 'https://www.lyft.com/ride?destination=[destination]'
        }
      },
      {
        utterancePattern: 'get lyft ride',
        intentType: 'bookRide',
        deepLink: {
          ios: 'lyft://ridetype?id=lyft',
          android: 'lyft://ridetype?id=lyft',
          web: 'https://www.lyft.com/ride'
        }
      },
      {
        utterancePattern: 'open lyft',
        intentType: 'openApp',
        deepLink: {
          ios: 'lyft://',
          android: 'lyft://',
          web: 'https://www.lyft.com'
        }
      }
    ]
  },

  // ============================================
  // SHOPPING APPS
  // ============================================
  {
    id: 'amazon',
    name: 'Amazon',
    icon: '📦',
    category: 'shopping',
    intents: [
      {
        utterancePattern: 'search amazon for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'com.amazon.mobile.shopping://www.amazon.com/s?k=[query]',
          android: 'amzn://amazon.com/s?k=[query]',
          web: 'https://www.amazon.com/s?k=[query]'
        }
      },
      {
        utterancePattern: 'buy on amazon',
        intentType: 'searchApp',
        deepLink: {
          ios: 'com.amazon.mobile.shopping://www.amazon.com/dp/[asin]',
          android: 'amzn://amazon.com/dp/[asin]',
          web: 'https://www.amazon.com/dp/[asin]'
        }
      },
      {
        utterancePattern: 'open amazon',
        intentType: 'openApp',
        deepLink: {
          ios: 'com.amazon.mobile.shopping://',
          android: 'amzn://',
          web: 'https://www.amazon.com'
        }
      }
    ]
  },
  {
    id: 'ebay',
    name: 'eBay',
    icon: '🛒',
    category: 'shopping',
    intents: [
      {
        utterancePattern: 'search ebay for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'ebay://search?keyword=[query]',
          android: 'ebay://search?keyword=[query]',
          web: 'https://www.ebay.com/sch/i.html?_nkw=[query]'
        }
      },
      {
        utterancePattern: 'open ebay',
        intentType: 'openApp',
        deepLink: {
          ios: 'ebay://',
          android: 'ebay://',
          web: 'https://www.ebay.com'
        }
      }
    ]
  },
  {
    id: 'walmart',
    name: 'Walmart',
    icon: '🏪',
    category: 'shopping',
    intents: [
      {
        utterancePattern: 'search walmart for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'walmart://search?query=[query]',
          android: 'walmart://search?query=[query]',
          web: 'https://www.walmart.com/search?q=[query]'
        }
      },
      {
        utterancePattern: 'open walmart',
        intentType: 'openApp',
        deepLink: {
          ios: 'walmart://',
          android: 'walmart://',
          web: 'https://www.walmart.com'
        }
      }
    ]
  },
  {
    id: 'target',
    name: 'Target',
    icon: '🎯',
    category: 'shopping',
    intents: [
      {
        utterancePattern: 'search target for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'target://search?searchTerm=[query]',
          android: 'target://search?searchTerm=[query]',
          web: 'https://www.target.com/s?searchTerm=[query]'
        }
      },
      {
        utterancePattern: 'open target',
        intentType: 'openApp',
        deepLink: {
          ios: 'target://',
          android: 'target://',
          web: 'https://www.target.com'
        }
      }
    ]
  },
  {
    id: 'doordash',
    name: 'DoorDash',
    icon: '🍔',
    category: 'shopping',
    intents: [
      {
        utterancePattern: 'order food on doordash',
        intentType: 'orderFood',
        deepLink: {
          ios: 'doordash://',
          android: 'doordash://',
          web: 'https://www.doordash.com'
        }
      },
      {
        utterancePattern: 'search doordash for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'doordash://search?query=[query]',
          android: 'doordash://search?query=[query]',
          web: 'https://www.doordash.com/search/store/[query]'
        }
      },
      {
        utterancePattern: 'open doordash',
        intentType: 'openApp',
        deepLink: {
          ios: 'doordash://',
          android: 'doordash://',
          web: 'https://www.doordash.com'
        }
      }
    ]
  },
  {
    id: 'grubhub',
    name: 'Grubhub',
    icon: '🍕',
    category: 'shopping',
    intents: [
      {
        utterancePattern: 'order food on grubhub',
        intentType: 'orderFood',
        deepLink: {
          ios: 'grubhub://',
          android: 'grubhub://',
          web: 'https://www.grubhub.com'
        }
      },
      {
        utterancePattern: 'search grubhub for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'grubhub://search?query=[query]',
          android: 'grubhub://search?query=[query]',
          web: 'https://www.grubhub.com/search?orderMethod=delivery&queryText=[query]'
        }
      },
      {
        utterancePattern: 'open grubhub',
        intentType: 'openApp',
        deepLink: {
          ios: 'grubhub://',
          android: 'grubhub://',
          web: 'https://www.grubhub.com'
        }
      }
    ]
  },
  {
    id: 'uber-eats',
    name: 'Uber Eats',
    icon: '🥡',
    category: 'shopping',
    intents: [
      {
        utterancePattern: 'order food on uber eats',
        intentType: 'orderFood',
        deepLink: {
          ios: 'ubereats://',
          android: 'ubereats://',
          web: 'https://www.ubereats.com'
        }
      },
      {
        utterancePattern: 'search uber eats for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'ubereats://search?query=[query]',
          android: 'ubereats://search?query=[query]',
          web: 'https://www.ubereats.com/search?q=[query]'
        }
      },
      {
        utterancePattern: 'open uber eats',
        intentType: 'openApp',
        deepLink: {
          ios: 'ubereats://',
          android: 'ubereats://',
          web: 'https://www.ubereats.com'
        }
      }
    ]
  },

  // ============================================
  // SOCIAL APPS
  // ============================================
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '📸',
    category: 'social',
    intents: [
      {
        utterancePattern: 'open instagram profile',
        intentType: 'searchProfile',
        deepLink: {
          ios: 'instagram://user?username=[username]',
          android: 'instagram://user?username=[username]',
          web: 'https://www.instagram.com/[username]'
        }
      },
      {
        utterancePattern: 'search instagram for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'instagram://tag?name=[query]',
          android: 'instagram://tag?name=[query]',
          web: 'https://www.instagram.com/explore/tags/[query]'
        }
      },
      {
        utterancePattern: 'open instagram',
        intentType: 'openApp',
        deepLink: {
          ios: 'instagram://',
          android: 'instagram://',
          web: 'https://www.instagram.com'
        }
      },
      {
        utterancePattern: 'send instagram dm',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'instagram://direct-inbox',
          android: 'instagram://direct-inbox',
          web: 'https://www.instagram.com/direct/inbox'
        }
      }
    ]
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    category: 'social',
    intents: [
      {
        utterancePattern: 'open tiktok profile',
        intentType: 'searchProfile',
        deepLink: {
          ios: 'snssdk1233://user/profile/[userId]',
          android: 'snssdk1233://user/profile/[userId]',
          web: 'https://www.tiktok.com/@[username]'
        }
      },
      {
        utterancePattern: 'search tiktok for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'snssdk1233://search?keyword=[query]',
          android: 'snssdk1233://search?keyword=[query]',
          web: 'https://www.tiktok.com/search?q=[query]'
        }
      },
      {
        utterancePattern: 'open tiktok',
        intentType: 'openApp',
        deepLink: {
          ios: 'snssdk1233://',
          android: 'snssdk1233://',
          web: 'https://www.tiktok.com'
        }
      }
    ]
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: '🐦',
    category: 'social',
    intents: [
      {
        utterancePattern: 'open twitter profile',
        intentType: 'searchProfile',
        deepLink: {
          ios: 'twitter://user?screen_name=[username]',
          android: 'twitter://user?screen_name=[username]',
          web: 'https://x.com/[username]'
        }
      },
      {
        utterancePattern: 'post on twitter',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'twitter://post?message=[text]',
          android: 'twitter://post?message=[text]',
          web: 'https://x.com/intent/tweet?text=[text]'
        }
      },
      {
        utterancePattern: 'search twitter for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'twitter://search?query=[query]',
          android: 'twitter://search?query=[query]',
          web: 'https://x.com/search?q=[query]'
        }
      },
      {
        utterancePattern: 'open twitter',
        intentType: 'openApp',
        deepLink: {
          ios: 'twitter://',
          android: 'twitter://',
          web: 'https://x.com'
        }
      }
    ]
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '👥',
    category: 'social',
    intents: [
      {
        utterancePattern: 'open facebook profile',
        intentType: 'searchProfile',
        deepLink: {
          ios: 'fb://profile/[userId]',
          android: 'fb://profile/[userId]',
          web: 'https://www.facebook.com/[username]'
        }
      },
      {
        utterancePattern: 'search facebook for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'fb://search/?query=[query]',
          android: 'fb://search/?query=[query]',
          web: 'https://www.facebook.com/search/top/?q=[query]'
        }
      },
      {
        utterancePattern: 'open facebook',
        intentType: 'openApp',
        deepLink: {
          ios: 'fb://',
          android: 'fb://',
          web: 'https://www.facebook.com'
        }
      },
      {
        utterancePattern: 'post on facebook',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'fb://publish/profile/me?text=[text]',
          android: 'fb://publish/profile/me?text=[text]',
          web: 'https://www.facebook.com/sharer/sharer.php?quote=[text]'
        }
      }
    ]
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    category: 'social',
    intents: [
      {
        utterancePattern: 'open linkedin profile',
        intentType: 'searchProfile',
        deepLink: {
          ios: 'linkedin://profile/[profileId]',
          android: 'linkedin://profile/[profileId]',
          web: 'https://www.linkedin.com/in/[username]'
        }
      },
      {
        utterancePattern: 'search linkedin for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'linkedin://search/results/all/?keywords=[query]',
          android: 'linkedin://search/results/all/?keywords=[query]',
          web: 'https://www.linkedin.com/search/results/all/?keywords=[query]'
        }
      },
      {
        utterancePattern: 'open linkedin',
        intentType: 'openApp',
        deepLink: {
          ios: 'linkedin://',
          android: 'linkedin://',
          web: 'https://www.linkedin.com'
        }
      },
      {
        utterancePattern: 'send linkedin message',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'linkedin://messaging',
          android: 'linkedin://messaging',
          web: 'https://www.linkedin.com/messaging'
        }
      }
    ]
  },
  {
    id: 'reddit',
    name: 'Reddit',
    icon: '🤖',
    category: 'social',
    intents: [
      {
        utterancePattern: 'open subreddit',
        intentType: 'openApp',
        deepLink: {
          ios: 'reddit://r/[subreddit]',
          android: 'reddit://r/[subreddit]',
          web: 'https://www.reddit.com/r/[subreddit]'
        }
      },
      {
        utterancePattern: 'search reddit for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'reddit://search?query=[query]',
          android: 'reddit://search?query=[query]',
          web: 'https://www.reddit.com/search/?q=[query]'
        }
      },
      {
        utterancePattern: 'open reddit',
        intentType: 'openApp',
        deepLink: {
          ios: 'reddit://',
          android: 'reddit://',
          web: 'https://www.reddit.com'
        }
      }
    ]
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: '📌',
    category: 'social',
    intents: [
      {
        utterancePattern: 'search pinterest for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'pinterest://search/pins/?q=[query]',
          android: 'pinterest://search/pins/?q=[query]',
          web: 'https://www.pinterest.com/search/pins/?q=[query]'
        }
      },
      {
        utterancePattern: 'open pinterest',
        intentType: 'openApp',
        deepLink: {
          ios: 'pinterest://',
          android: 'pinterest://',
          web: 'https://www.pinterest.com'
        }
      },
      {
        utterancePattern: 'open pinterest profile',
        intentType: 'searchProfile',
        deepLink: {
          ios: 'pinterest://user/[username]',
          android: 'pinterest://user/[username]',
          web: 'https://www.pinterest.com/[username]'
        }
      }
    ]
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    icon: '👻',
    category: 'social',
    intents: [
      {
        utterancePattern: 'add on snapchat',
        intentType: 'searchProfile',
        deepLink: {
          ios: 'snapchat://add/[username]',
          android: 'snapchat://add/[username]',
          web: 'https://www.snapchat.com/add/[username]'
        }
      },
      {
        utterancePattern: 'open snapchat',
        intentType: 'openApp',
        deepLink: {
          ios: 'snapchat://',
          android: 'snapchat://',
          web: 'https://www.snapchat.com'
        }
      },
      {
        utterancePattern: 'send snap to [contact]',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'snapchat://chat?username=[username]',
          android: 'snapchat://chat?username=[username]',
          web: 'https://www.snapchat.com'
        }
      }
    ]
  },

  // ============================================
  // PRODUCTIVITY APPS
  // ============================================
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    category: 'productivity',
    intents: [
      {
        utterancePattern: 'send email to [contact]',
        intentType: 'emailContact',
        deepLink: {
          ios: 'googlegmail:///co?to=[email]&subject=[subject]&body=[body]',
          android: 'intent://mail/?to=[email]&subject=[subject]&body=[body]#Intent;scheme=gmail;package=com.google.android.gm;end',
          web: 'https://mail.google.com/mail/?view=cm&to=[email]&su=[subject]&body=[body]'
        }
      },
      {
        utterancePattern: 'compose email',
        intentType: 'emailContact',
        deepLink: {
          ios: 'googlegmail:///co',
          android: 'intent://mail/#Intent;scheme=gmail;package=com.google.android.gm;end',
          web: 'https://mail.google.com/mail/?view=cm'
        }
      },
      {
        utterancePattern: 'open gmail',
        intentType: 'openApp',
        deepLink: {
          ios: 'googlegmail://',
          android: 'intent://#Intent;scheme=gmail;package=com.google.android.gm;end',
          web: 'https://mail.google.com'
        }
      },
      {
        utterancePattern: 'search gmail for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'googlegmail:///search?q=[query]',
          android: 'intent://mail/search?q=[query]#Intent;scheme=gmail;package=com.google.android.gm;end',
          web: 'https://mail.google.com/mail/u/0/#search/[query]'
        }
      }
    ]
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '📬',
    category: 'productivity',
    intents: [
      {
        utterancePattern: 'send outlook email',
        intentType: 'emailContact',
        deepLink: {
          ios: 'ms-outlook://compose?to=[email]&subject=[subject]&body=[body]',
          android: 'ms-outlook://compose?to=[email]&subject=[subject]&body=[body]',
          web: 'https://outlook.live.com/mail/0/deeplink/compose?to=[email]&subject=[subject]&body=[body]'
        }
      },
      {
        utterancePattern: 'open outlook',
        intentType: 'openApp',
        deepLink: {
          ios: 'ms-outlook://',
          android: 'ms-outlook://',
          web: 'https://outlook.live.com'
        }
      },
      {
        utterancePattern: 'search outlook for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'ms-outlook://search?q=[query]',
          android: 'ms-outlook://search?q=[query]',
          web: 'https://outlook.live.com/mail/0/search?q=[query]'
        }
      }
    ]
  },
  {
    id: 'zoom',
    name: 'Zoom',
    icon: '📹',
    category: 'productivity',
    intents: [
      {
        utterancePattern: 'join zoom meeting',
        intentType: 'openApp',
        deepLink: {
          ios: 'zoomus://zoom.us/join?confno=[meetingId]&pwd=[password]',
          android: 'zoomus://zoom.us/join?confno=[meetingId]&pwd=[password]',
          web: 'https://zoom.us/j/[meetingId]?pwd=[password]'
        }
      },
      {
        utterancePattern: 'start zoom meeting',
        intentType: 'openApp',
        deepLink: {
          ios: 'zoomus://zoom.us/start?confno=[meetingId]',
          android: 'zoomus://zoom.us/start?confno=[meetingId]',
          web: 'https://zoom.us/start'
        }
      },
      {
        utterancePattern: 'open zoom',
        intentType: 'openApp',
        deepLink: {
          ios: 'zoomus://',
          android: 'zoomus://',
          web: 'https://zoom.us'
        }
      }
    ]
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    icon: '👥',
    category: 'productivity',
    intents: [
      {
        utterancePattern: 'join teams meeting',
        intentType: 'openApp',
        deepLink: {
          ios: 'msteams://teams.microsoft.com/l/meetup-join/[meetingId]',
          android: 'msteams://teams.microsoft.com/l/meetup-join/[meetingId]',
          web: 'https://teams.microsoft.com/l/meetup-join/[meetingId]'
        }
      },
      {
        utterancePattern: 'send teams message',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'msteams://teams.microsoft.com/l/chat/0/0?users=[email]',
          android: 'msteams://teams.microsoft.com/l/chat/0/0?users=[email]',
          web: 'https://teams.microsoft.com/l/chat/0/0?users=[email]'
        }
      },
      {
        utterancePattern: 'open teams',
        intentType: 'openApp',
        deepLink: {
          ios: 'msteams://',
          android: 'msteams://',
          web: 'https://teams.microsoft.com'
        }
      }
    ]
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: '📓',
    category: 'productivity',
    intents: [
      {
        utterancePattern: 'open notion page',
        intentType: 'openApp',
        deepLink: {
          ios: 'notion://www.notion.so/[pageId]',
          android: 'notion://www.notion.so/[pageId]',
          web: 'https://www.notion.so/[pageId]'
        }
      },
      {
        utterancePattern: 'search notion for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'notion://www.notion.so/search?q=[query]',
          android: 'notion://www.notion.so/search?q=[query]',
          web: 'https://www.notion.so/search?q=[query]'
        }
      },
      {
        utterancePattern: 'open notion',
        intentType: 'openApp',
        deepLink: {
          ios: 'notion://',
          android: 'notion://',
          web: 'https://www.notion.so'
        }
      }
    ]
  },
  {
    id: 'figma',
    name: 'Figma',
    icon: '🎨',
    category: 'productivity',
    intents: [
      {
        utterancePattern: 'open figma file',
        intentType: 'searchFile',
        deepLink: {
          ios: 'figma://file/[fileKey]',
          android: 'figma://file/[fileKey]',
          web: 'https://www.figma.com/file/[fileKey]'
        }
      },
      {
        utterancePattern: 'open figma',
        intentType: 'openApp',
        deepLink: {
          ios: 'figma://',
          android: 'figma://',
          web: 'https://www.figma.com'
        }
      }
    ]
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: '📁',
    category: 'productivity',
    intents: [
      {
        utterancePattern: 'open google drive file',
        intentType: 'searchFile',
        deepLink: {
          ios: 'googledrive://open?id=[fileId]',
          android: 'googledrive://open?id=[fileId]',
          web: 'https://drive.google.com/file/d/[fileId]'
        }
      },
      {
        utterancePattern: 'search google drive for [query]',
        intentType: 'searchFile',
        deepLink: {
          ios: 'googledrive://search?q=[query]',
          android: 'googledrive://search?q=[query]',
          web: 'https://drive.google.com/drive/search?q=[query]'
        }
      },
      {
        utterancePattern: 'open google drive',
        intentType: 'openApp',
        deepLink: {
          ios: 'googledrive://',
          android: 'googledrive://',
          web: 'https://drive.google.com'
        }
      }
    ]
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: '📂',
    category: 'productivity',
    intents: [
      {
        utterancePattern: 'open dropbox file',
        intentType: 'searchFile',
        deepLink: {
          ios: 'dbapi-1://1/view?path=[filePath]',
          android: 'dbapi-1://1/view?path=[filePath]',
          web: 'https://www.dropbox.com/home/[filePath]'
        }
      },
      {
        utterancePattern: 'search dropbox for [query]',
        intentType: 'searchFile',
        deepLink: {
          ios: 'dbapi-1://1/search?query=[query]',
          android: 'dbapi-1://1/search?query=[query]',
          web: 'https://www.dropbox.com/search/personal?query=[query]'
        }
      },
      {
        utterancePattern: 'open dropbox',
        intentType: 'openApp',
        deepLink: {
          ios: 'dbapi-1://',
          android: 'dbapi-1://',
          web: 'https://www.dropbox.com'
        }
      }
    ]
  },

  // ============================================
  // FINANCE APPS
  // ============================================
  {
    id: 'venmo',
    name: 'Venmo',
    icon: '💸',
    category: 'finance',
    intents: [
      {
        utterancePattern: 'send money on venmo',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'venmo://paycharge?txn=pay&recipients=[username]&amount=[amount]&note=[note]',
          android: 'venmo://paycharge?txn=pay&recipients=[username]&amount=[amount]&note=[note]',
          web: 'https://venmo.com/[username]'
        }
      },
      {
        utterancePattern: 'pay on venmo',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'venmo://paycharge?txn=pay',
          android: 'venmo://paycharge?txn=pay',
          web: 'https://venmo.com'
        }
      },
      {
        utterancePattern: 'open venmo',
        intentType: 'openApp',
        deepLink: {
          ios: 'venmo://',
          android: 'venmo://',
          web: 'https://venmo.com'
        }
      },
      {
        utterancePattern: 'request money on venmo',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'venmo://paycharge?txn=charge&recipients=[username]&amount=[amount]&note=[note]',
          android: 'venmo://paycharge?txn=charge&recipients=[username]&amount=[amount]&note=[note]',
          web: 'https://venmo.com/[username]'
        }
      }
    ]
  },
  {
    id: 'cash-app',
    name: 'Cash App',
    icon: '💵',
    category: 'finance',
    intents: [
      {
        utterancePattern: 'send money on cash app',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'cashme://cash.app/$[cashtag]?amount=[amount]',
          android: 'cashme://cash.app/$[cashtag]?amount=[amount]',
          web: 'https://cash.app/$[cashtag]'
        }
      },
      {
        utterancePattern: 'pay on cash app',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'cashme://cash.app/$[cashtag]',
          android: 'cashme://cash.app/$[cashtag]',
          web: 'https://cash.app/$[cashtag]'
        }
      },
      {
        utterancePattern: 'open cash app',
        intentType: 'openApp',
        deepLink: {
          ios: 'cashme://',
          android: 'cashme://',
          web: 'https://cash.app'
        }
      }
    ]
  },
  {
    id: 'paypal',
    name: 'PayPal',
    icon: '💳',
    category: 'finance',
    intents: [
      {
        utterancePattern: 'send money on paypal',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'paypal://paypalme/[username]/[amount]',
          android: 'paypal://paypalme/[username]/[amount]',
          web: 'https://www.paypal.me/[username]/[amount]'
        }
      },
      {
        utterancePattern: 'pay with paypal',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'paypal://paypalme/[username]',
          android: 'paypal://paypalme/[username]',
          web: 'https://www.paypal.me/[username]'
        }
      },
      {
        utterancePattern: 'open paypal',
        intentType: 'openApp',
        deepLink: {
          ios: 'paypal://',
          android: 'paypal://',
          web: 'https://www.paypal.com'
        }
      }
    ]
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    icon: '🪙',
    category: 'finance',
    intents: [
      {
        utterancePattern: 'buy crypto on coinbase',
        intentType: 'openApp',
        deepLink: {
          ios: 'coinbase://buy?asset=[asset]',
          android: 'coinbase://buy?asset=[asset]',
          web: 'https://www.coinbase.com/price/[asset]'
        }
      },
      {
        utterancePattern: 'check coinbase portfolio',
        intentType: 'openApp',
        deepLink: {
          ios: 'coinbase://portfolio',
          android: 'coinbase://portfolio',
          web: 'https://www.coinbase.com/portfolio'
        }
      },
      {
        utterancePattern: 'open coinbase',
        intentType: 'openApp',
        deepLink: {
          ios: 'coinbase://',
          android: 'coinbase://',
          web: 'https://www.coinbase.com'
        }
      },
      {
        utterancePattern: 'send crypto on coinbase',
        intentType: 'sendMessage',
        deepLink: {
          ios: 'coinbase://send?asset=[asset]&address=[address]&amount=[amount]',
          android: 'coinbase://send?asset=[asset]&address=[address]&amount=[amount]',
          web: 'https://www.coinbase.com/send'
        }
      }
    ]
  },
  {
    id: 'robinhood',
    name: 'Robinhood',
    icon: '📈',
    category: 'finance',
    intents: [
      {
        utterancePattern: 'check stock on robinhood',
        intentType: 'searchApp',
        deepLink: {
          ios: 'robinhood://instrument?symbol=[symbol]',
          android: 'robinhood://instrument?symbol=[symbol]',
          web: 'https://robinhood.com/stocks/[symbol]'
        }
      },
      {
        utterancePattern: 'search robinhood for [query]',
        intentType: 'searchApp',
        deepLink: {
          ios: 'robinhood://search?query=[query]',
          android: 'robinhood://search?query=[query]',
          web: 'https://robinhood.com/search?query=[query]'
        }
      },
      {
        utterancePattern: 'open robinhood',
        intentType: 'openApp',
        deepLink: {
          ios: 'robinhood://',
          android: 'robinhood://',
          web: 'https://robinhood.com'
        }
      },
      {
        utterancePattern: 'check robinhood portfolio',
        intentType: 'openApp',
        deepLink: {
          ios: 'robinhood://portfolio',
          android: 'robinhood://portfolio',
          web: 'https://robinhood.com/portfolio'
        }
      }
    ]
  }
];

export interface DeepLinkResult {
  app: AppManifest;
  intent: AppIntent;
  platform: 'ios' | 'android' | 'web';
  url: string;
  parameters: Record<string, string>;
}

function detectPlatform(): 'ios' | 'android' | 'web' {
  if (typeof navigator === 'undefined') return 'web';
  
  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  return 'web';
}

function extractParameters(utterance: string, pattern: string): Record<string, string> {
  const params: Record<string, string> = {};
  
  const paramRegex = /\[(\w+)\]/g;
  const paramNames: string[] = [];
  let match;
  while ((match = paramRegex.exec(pattern)) !== null) {
    paramNames.push(match[1]);
  }
  
  const patternRegex = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\[(\w+)\\\]/g, '(.+?)');
  
  const regex = new RegExp(patternRegex, 'i');
  const utteranceMatch = utterance.match(regex);
  
  if (utteranceMatch) {
    paramNames.forEach((name, index) => {
      if (utteranceMatch[index + 1]) {
        params[name] = utteranceMatch[index + 1].trim();
      }
    });
  }
  
  return params;
}

function substituteParameters(url: string, params: Record<string, string>): string {
  let result = url;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`[${key}]`, encodeURIComponent(value));
  }
  return result;
}

function matchUtterance(utterance: string, pattern: string): boolean {
  const normalizedUtterance = utterance.toLowerCase().trim();
  const patternWithoutParams = pattern.replace(/\[(\w+)\]/g, '(.+?)');
  const regex = new RegExp(`^${patternWithoutParams}$`, 'i');
  
  if (regex.test(normalizedUtterance)) return true;
  
  const keywords = pattern
    .replace(/\[(\w+)\]/g, '')
    .split(' ')
    .filter(word => word.length > 0);
  
  const keywordsMatch = keywords.every(keyword => 
    normalizedUtterance.includes(keyword.toLowerCase())
  );
  
  return keywordsMatch && keywords.length > 0;
}

export function getDeepLinkForIntent(
  utterance: string,
  platform?: 'ios' | 'android' | 'web'
): DeepLinkResult | null {
  const targetPlatform = platform || detectPlatform();
  const normalizedUtterance = utterance.toLowerCase().trim();
  
  for (const app of deepLinkManifest) {
    for (const intent of app.intents) {
      if (matchUtterance(normalizedUtterance, intent.utterancePattern)) {
        const params = extractParameters(normalizedUtterance, intent.utterancePattern);
        const url = substituteParameters(intent.deepLink[targetPlatform], params);
        
        return {
          app,
          intent,
          platform: targetPlatform,
          url,
          parameters: params
        };
      }
    }
  }
  
  return null;
}

export function getAllApps(): AppManifest[] {
  return [...deepLinkManifest];
}

export function getAppById(id: string): AppManifest | undefined {
  return deepLinkManifest.find(app => app.id === id);
}

export function getAppsByCategory(category: AppCategory): AppManifest[] {
  return deepLinkManifest.filter(app => app.category === category);
}

export function getAppsByIntentType(intentType: IntentType): AppManifest[] {
  return deepLinkManifest.filter(app => 
    app.intents.some(intent => intent.intentType === intentType)
  );
}

export function searchApps(query: string): AppManifest[] {
  const normalizedQuery = query.toLowerCase().trim();
  return deepLinkManifest.filter(app => 
    app.name.toLowerCase().includes(normalizedQuery) ||
    app.id.toLowerCase().includes(normalizedQuery) ||
    app.category.toLowerCase().includes(normalizedQuery)
  );
}

export function generateDeepLink(
  appId: string,
  intentPattern: string,
  params: Record<string, string>,
  platform?: 'ios' | 'android' | 'web'
): string | null {
  const app = getAppById(appId);
  if (!app) return null;
  
  const intent = app.intents.find(i => i.utterancePattern === intentPattern);
  if (!intent) return null;
  
  const targetPlatform = platform || detectPlatform();
  return substituteParameters(intent.deepLink[targetPlatform], params);
}

export const CATEGORIES: AppCategory[] = [
  'messaging',
  'music',
  'video',
  'navigation',
  'shopping',
  'social',
  'productivity',
  'finance'
];

export const INTENT_TYPES: IntentType[] = [
  'openApp',
  'playMedia',
  'searchApp',
  'sendMessage',
  'callContact',
  'emailContact',
  'navigateTo',
  'bookRide',
  'orderFood',
  'searchFile',
  'searchProfile'
];
