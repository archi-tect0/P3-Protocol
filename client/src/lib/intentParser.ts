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

export interface ParsedIntent {
  intentType: IntentType;
  appName: string | null;
  query: string | null;
  rawUtterance: string;
  messageContent?: string;
}

const KNOWN_APPS = [
  'spotify', 'netflix', 'youtube', 'whatsapp', 'telegram', 'messenger',
  'instagram', 'twitter', 'x', 'facebook', 'tiktok', 'snapchat',
  'gmail', 'outlook', 'slack', 'discord', 'zoom', 'teams',
  'uber', 'lyft', 'doordash', 'ubereats', 'grubhub', 'postmates', 'instacart',
  'google maps', 'maps', 'waze', 'apple maps',
  'amazon', 'ebay', 'etsy', 'walmart', 'target',
  'dropbox', 'drive', 'onedrive', 'icloud',
  'linkedin', 'indeed', 'glassdoor',
  'venmo', 'paypal', 'cashapp', 'zelle',
  'hulu', 'disney', 'disney+', 'hbo', 'prime video', 'apple tv',
  'apple music', 'pandora', 'soundcloud', 'tidal', 'deezer',
  'reddit', 'pinterest', 'tumblr',
  'notion', 'evernote', 'onenote', 'notes',
  'calendar', 'reminders', 'clock', 'weather',
  'camera', 'photos', 'gallery',
  'settings', 'phone', 'contacts', 'messages',
  'safari', 'chrome', 'firefox', 'edge', 'browser',
  'figma', 'canva', 'photoshop', 'illustrator',
  'github', 'gitlab', 'bitbucket', 'jira', 'trello', 'asana',
];

const RIDE_SERVICES = ['uber', 'lyft', 'via', 'curb', 'grab', 'bolt', 'ola', 'didi'];
const FOOD_SERVICES = ['doordash', 'ubereats', 'uber eats', 'grubhub', 'postmates', 'instacart', 'seamless', 'deliveroo', 'just eat'];
const MESSAGING_APPS = ['whatsapp', 'telegram', 'messenger', 'imessage', 'messages', 'signal', 'viber', 'wechat'];
const EMAIL_APPS = ['gmail', 'outlook', 'mail', 'email', 'yahoo mail', 'protonmail'];
const MEDIA_APPS = ['spotify', 'apple music', 'youtube', 'youtube music', 'netflix', 'hulu', 'disney+', 'hbo', 'prime video', 'pandora', 'soundcloud', 'tidal'];
const NAVIGATION_APPS = ['google maps', 'maps', 'waze', 'apple maps', 'here maps', 'tomtom'];

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function extractAppName(text: string): string | null {
  const normalized = normalizeText(text);
  
  const sortedApps = [...KNOWN_APPS].sort((a, b) => b.length - a.length);
  
  for (const app of sortedApps) {
    if (normalized.includes(app)) {
      return app;
    }
  }
  
  return null;
}


function parseOpenApp(utterance: string): ParsedIntent | null {
  const normalized = normalizeText(utterance);
  
  const openPatterns = [
    /^open\s+(.+)$/i,
    /^launch\s+(.+)$/i,
    /^start\s+(.+)$/i,
    /^run\s+(.+)$/i,
    /^go\s+to\s+(.+)\s+app$/i,
  ];
  
  for (const pattern of openPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const appPart = match[1].trim();
      const appName = extractAppName(appPart) || appPart;
      return {
        intentType: 'openApp',
        appName,
        query: null,
        rawUtterance: utterance,
      };
    }
  }
  
  const singleApp = extractAppName(normalized);
  if (singleApp && normalized.replace(singleApp, '').trim() === '') {
    return {
      intentType: 'openApp',
      appName: singleApp,
      query: null,
      rawUtterance: utterance,
    };
  }
  
  return null;
}

function parsePlayMedia(utterance: string): ParsedIntent | null {
  const normalized = normalizeText(utterance);
  
  const playOnPattern = /^play\s+(.+?)\s+on\s+(.+)$/i;
  const playOnMatch = normalized.match(playOnPattern);
  if (playOnMatch) {
    const query = playOnMatch[1].trim();
    const appPart = playOnMatch[2].trim();
    const appName = extractAppName(appPart) || appPart;
    return {
      intentType: 'playMedia',
      appName,
      query,
      rawUtterance: utterance,
    };
  }
  
  const playInPattern = /^play\s+(.+?)\s+in\s+(.+)$/i;
  const playInMatch = normalized.match(playInPattern);
  if (playInMatch) {
    const query = playInMatch[1].trim();
    const appPart = playInMatch[2].trim();
    const appName = extractAppName(appPart) || appPart;
    return {
      intentType: 'playMedia',
      appName,
      query,
      rawUtterance: utterance,
    };
  }
  
  const playFromPattern = /^play\s+(.+?)\s+from\s+(.+)$/i;
  const playFromMatch = normalized.match(playFromPattern);
  if (playFromMatch) {
    const query = playFromMatch[1].trim();
    const appPart = playFromMatch[2].trim();
    const appName = extractAppName(appPart) || appPart;
    return {
      intentType: 'playMedia',
      appName,
      query,
      rawUtterance: utterance,
    };
  }
  
  const playPatterns = [
    /^play\s+(.+)$/i,
    /^listen\s+to\s+(.+)$/i,
    /^watch\s+(.+)$/i,
    /^stream\s+(.+)$/i,
    /^put\s+on\s+(.+)$/i,
  ];
  
  for (const pattern of playPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const queryPart = match[1].trim();
      const appName = extractAppName(queryPart);
      
      let query = queryPart;
      if (appName) {
        const onIndex = queryPart.indexOf(' on ');
        const inIndex = queryPart.indexOf(' in ');
        const fromIndex = queryPart.indexOf(' from ');
        
        if (onIndex === -1 && inIndex === -1 && fromIndex === -1) {
          query = queryPart.replace(new RegExp(appName, 'gi'), '').trim();
        }
      }
      
      return {
        intentType: 'playMedia',
        appName,
        query: query || null,
        rawUtterance: utterance,
      };
    }
  }
  
  return null;
}

function parseSearchApp(utterance: string): ParsedIntent | null {
  const normalized = normalizeText(utterance);
  
  const searchOnPattern = /^search\s+(?:for\s+)?(.+?)\s+on\s+(.+)$/i;
  const searchOnMatch = normalized.match(searchOnPattern);
  if (searchOnMatch) {
    const query = searchOnMatch[1].trim();
    const appPart = searchOnMatch[2].trim();
    const appName = extractAppName(appPart) || appPart;
    return {
      intentType: 'searchApp',
      appName,
      query,
      rawUtterance: utterance,
    };
  }
  
  const searchInPattern = /^search\s+(?:for\s+)?(.+?)\s+in\s+(.+)$/i;
  const searchInMatch = normalized.match(searchInPattern);
  if (searchInMatch) {
    const query = searchInMatch[1].trim();
    const appPart = searchInMatch[2].trim();
    const appName = extractAppName(appPart) || appPart;
    return {
      intentType: 'searchApp',
      appName,
      query,
      rawUtterance: utterance,
    };
  }
  
  const lookupPattern = /^(?:look\s+up|lookup|find)\s+(.+?)\s+(?:on|in)\s+(.+)$/i;
  const lookupMatch = normalized.match(lookupPattern);
  if (lookupMatch) {
    const query = lookupMatch[1].trim();
    const appPart = lookupMatch[2].trim();
    const appName = extractAppName(appPart) || appPart;
    return {
      intentType: 'searchApp',
      appName,
      query,
      rawUtterance: utterance,
    };
  }
  
  const simpleSearchPattern = /^search\s+(?:for\s+)?(.+)$/i;
  const simpleMatch = normalized.match(simpleSearchPattern);
  if (simpleMatch) {
    const queryPart = simpleMatch[1].trim();
    const appName = extractAppName(queryPart);
    const query = appName ? queryPart.replace(new RegExp(appName, 'gi'), '').trim() : queryPart;
    
    return {
      intentType: 'searchApp',
      appName,
      query: query || null,
      rawUtterance: utterance,
    };
  }
  
  return null;
}

function parseSendMessage(utterance: string): ParsedIntent | null {
  const normalized = normalizeText(utterance);
  
  const sendMessageToPattern = /^send\s+(?:a\s+)?(?:message|text)\s+to\s+(.+?)(?:\s+saying\s+(.+))?$/i;
  const sendToMatch = normalized.match(sendMessageToPattern);
  if (sendToMatch) {
    const contact = sendToMatch[1].trim();
    const messageContent = sendToMatch[2]?.trim();
    const appName = extractAppName(contact);
    const cleanContact = appName ? contact.replace(new RegExp(`\\s*(on|via|using|through)\\s+${appName}`, 'gi'), '').trim() : contact;
    
    return {
      intentType: 'sendMessage',
      appName,
      query: cleanContact,
      rawUtterance: utterance,
      messageContent,
    };
  }
  
  const textSayingPattern = /^(?:text|message)\s+(.+?)\s+saying\s+(.+)$/i;
  const textSayingMatch = normalized.match(textSayingPattern);
  if (textSayingMatch) {
    const contact = textSayingMatch[1].trim();
    const messageContent = textSayingMatch[2].trim();
    const appName = extractAppName(contact);
    const cleanContact = appName ? contact.replace(new RegExp(`\\s*(on|via|using|through)\\s+${appName}`, 'gi'), '').trim() : contact;
    
    return {
      intentType: 'sendMessage',
      appName,
      query: cleanContact,
      rawUtterance: utterance,
      messageContent,
    };
  }
  
  const textThatPattern = /^(?:text|message)\s+(.+?)\s+that\s+(.+)$/i;
  const textThatMatch = normalized.match(textThatPattern);
  if (textThatMatch) {
    const contact = textThatMatch[1].trim();
    const messageContent = textThatMatch[2].trim();
    const appName = extractAppName(contact);
    const cleanContact = appName ? contact.replace(new RegExp(`\\s*(on|via|using|through)\\s+${appName}`, 'gi'), '').trim() : contact;
    
    return {
      intentType: 'sendMessage',
      appName,
      query: cleanContact,
      rawUtterance: utterance,
      messageContent,
    };
  }
  
  const textOnPattern = /^(?:text|message)\s+(.+?)\s+on\s+(.+)$/i;
  const textOnMatch = normalized.match(textOnPattern);
  if (textOnMatch) {
    const contact = textOnMatch[1].trim();
    const appPart = textOnMatch[2].trim();
    const appName = extractAppName(appPart) || appPart;
    
    return {
      intentType: 'sendMessage',
      appName,
      query: contact,
      rawUtterance: utterance,
    };
  }
  
  const simpleTextPatterns = [
    /^text\s+(.+)$/i,
    /^message\s+(.+)$/i,
    /^send\s+(.+)\s+a\s+message$/i,
    /^msg\s+(.+)$/i,
    /^dm\s+(.+)$/i,
  ];
  
  for (const pattern of simpleTextPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const contact = match[1].trim();
      const appName = extractAppName(contact);
      const cleanContact = appName 
        ? contact.replace(new RegExp(`\\s*(on|via|using|through)\\s+${appName}`, 'gi'), '').replace(new RegExp(appName, 'gi'), '').trim()
        : contact;
      
      return {
        intentType: 'sendMessage',
        appName,
        query: cleanContact || contact,
        rawUtterance: utterance,
      };
    }
  }
  
  return null;
}

function parseCallContact(utterance: string): ParsedIntent | null {
  const normalized = normalizeText(utterance);
  
  const callPatterns = [
    /^call\s+(.+)$/i,
    /^phone\s+(.+)$/i,
    /^dial\s+(.+)$/i,
    /^ring\s+(.+)$/i,
    /^facetime\s+(.+)$/i,
    /^video\s+call\s+(.+)$/i,
  ];
  
  for (const pattern of callPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const contact = match[1].trim();
      const appName = extractAppName(contact);
      const cleanContact = appName 
        ? contact.replace(new RegExp(`\\s*(on|via|using|through)\\s+${appName}`, 'gi'), '').replace(new RegExp(appName, 'gi'), '').trim()
        : contact;
      
      return {
        intentType: 'callContact',
        appName,
        query: cleanContact || contact,
        rawUtterance: utterance,
      };
    }
  }
  
  return null;
}

function parseEmailContact(utterance: string): ParsedIntent | null {
  const normalized = normalizeText(utterance);
  
  const emailAboutPattern = /^email\s+(.+?)\s+about\s+(.+)$/i;
  const emailAboutMatch = normalized.match(emailAboutPattern);
  if (emailAboutMatch) {
    const contact = emailAboutMatch[1].trim();
    const subject = emailAboutMatch[2].trim();
    const appName = extractAppName(contact);
    const cleanContact = appName 
      ? contact.replace(new RegExp(`\\s*(on|via|using|through)\\s+${appName}`, 'gi'), '').trim()
      : contact;
    
    return {
      intentType: 'emailContact',
      appName,
      query: cleanContact,
      rawUtterance: utterance,
      messageContent: subject,
    };
  }
  
  const emailPatterns = [
    /^email\s+(.+)$/i,
    /^send\s+(?:an\s+)?email\s+to\s+(.+)$/i,
    /^mail\s+(.+)$/i,
    /^compose\s+(?:an\s+)?email\s+to\s+(.+)$/i,
  ];
  
  for (const pattern of emailPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const contact = match[1].trim();
      const appName = extractAppName(contact);
      const cleanContact = appName 
        ? contact.replace(new RegExp(`\\s*(on|via|using|through)\\s+${appName}`, 'gi'), '').replace(new RegExp(appName, 'gi'), '').trim()
        : contact;
      
      return {
        intentType: 'emailContact',
        appName,
        query: cleanContact || contact,
        rawUtterance: utterance,
      };
    }
  }
  
  return null;
}

function parseNavigateTo(utterance: string): ParsedIntent | null {
  const normalized = normalizeText(utterance);
  
  const navPatterns = [
    /^navigate\s+to\s+(.+)$/i,
    /^directions\s+to\s+(.+)$/i,
    /^go\s+to\s+(.+)$/i,
    /^take\s+me\s+to\s+(.+)$/i,
    /^how\s+(?:do\s+i\s+)?get\s+to\s+(.+)$/i,
    /^drive\s+to\s+(.+)$/i,
    /^route\s+to\s+(.+)$/i,
    /^find\s+directions\s+to\s+(.+)$/i,
  ];
  
  for (const pattern of navPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      let destination = match[1].trim();
      let appName: string | null = null;
      
      const usingPattern = /(.+?)\s+(?:using|on|via|in|with)\s+(.+)$/i;
      const usingMatch = destination.match(usingPattern);
      if (usingMatch) {
        destination = usingMatch[1].trim();
        appName = extractAppName(usingMatch[2]) || usingMatch[2].trim();
      } else {
        appName = extractAppName(destination);
        if (appName && NAVIGATION_APPS.includes(appName)) {
          destination = destination.replace(new RegExp(appName, 'gi'), '').trim();
        } else {
          appName = null;
        }
      }
      
      return {
        intentType: 'navigateTo',
        appName,
        query: destination,
        rawUtterance: utterance,
      };
    }
  }
  
  return null;
}

function parseBookRide(utterance: string): ParsedIntent | null {
  const normalized = normalizeText(utterance);
  
  const ridePatterns = [
    /^book\s+(?:an?\s+)?(?:uber|lyft|ride)\s+to\s+(.+)$/i,
    /^get\s+(?:an?\s+)?(?:uber|lyft|ride)\s+to\s+(.+)$/i,
    /^order\s+(?:an?\s+)?(?:uber|lyft|ride)\s+to\s+(.+)$/i,
    /^request\s+(?:an?\s+)?(?:uber|lyft|ride)\s+to\s+(.+)$/i,
    /^(?:uber|lyft)\s+to\s+(.+)$/i,
    /^i\s+need\s+(?:a\s+)?ride\s+to\s+(.+)$/i,
    /^call\s+(?:an?\s+)?(?:uber|lyft)\s+to\s+(.+)$/i,
  ];
  
  for (const pattern of ridePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const destination = match[1].trim();
      
      let appName: string | null = null;
      for (const service of RIDE_SERVICES) {
        if (normalized.includes(service)) {
          appName = service;
          break;
        }
      }
      
      return {
        intentType: 'bookRide',
        appName,
        query: destination,
        rawUtterance: utterance,
      };
    }
  }
  
  const genericRidePattern = /^book\s+(?:a\s+)?ride$/i;
  if (genericRidePattern.test(normalized)) {
    return {
      intentType: 'bookRide',
      appName: null,
      query: null,
      rawUtterance: utterance,
    };
  }
  
  return null;
}

function parseOrderFood(utterance: string): ParsedIntent | null {
  const normalized = normalizeText(utterance);
  
  const orderOnPattern = /^order\s+(.+?)\s+(?:on|from|via|through)\s+(.+)$/i;
  const orderOnMatch = normalized.match(orderOnPattern);
  if (orderOnMatch) {
    const food = orderOnMatch[1].trim();
    const appPart = orderOnMatch[2].trim();
    const appName = extractAppName(appPart) || appPart;
    
    if (FOOD_SERVICES.some(s => normalized.includes(s)) || 
        food.toLowerCase().includes('food') || 
        food.toLowerCase().includes('pizza') ||
        food.toLowerCase().includes('burger') ||
        food.toLowerCase().includes('sushi') ||
        food.toLowerCase().includes('chinese') ||
        food.toLowerCase().includes('indian') ||
        food.toLowerCase().includes('thai') ||
        food.toLowerCase().includes('mexican')) {
      return {
        intentType: 'orderFood',
        appName,
        query: food,
        rawUtterance: utterance,
      };
    }
  }
  
  const orderPatterns = [
    /^order\s+(?:some\s+)?(.+?)(?:\s+delivery)?$/i,
    /^get\s+(.+?)\s+delivered$/i,
    /^(?:i\s+)?want\s+(.+?)\s+delivered$/i,
    /^deliver\s+(.+)$/i,
  ];
  
  for (const pattern of orderPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const food = match[1].trim();
      let appName: string | null = null;
      
      for (const service of FOOD_SERVICES) {
        if (normalized.includes(service)) {
          appName = service;
          break;
        }
      }
      
      if (appName || 
          food.toLowerCase().includes('food') ||
          food.toLowerCase().includes('pizza') ||
          food.toLowerCase().includes('burger') ||
          food.toLowerCase().includes('sushi') ||
          food.toLowerCase().includes('delivery')) {
        return {
          intentType: 'orderFood',
          appName,
          query: food.replace(new RegExp(`\\s*(from|on|via)\\s+${appName || ''}`, 'gi'), '').trim(),
          rawUtterance: utterance,
        };
      }
    }
  }
  
  return null;
}

function parseSearchFile(utterance: string): ParsedIntent | null {
  const normalized = normalizeText(utterance);
  
  const filePatterns = [
    /^find\s+(?:my\s+)?file\s+(?:called\s+|named\s+)?(.+)$/i,
    /^search\s+(?:for\s+)?(?:my\s+)?files?\s+(?:called\s+|named\s+)?(.+)$/i,
    /^look\s+for\s+(?:my\s+)?document\s+(.+)$/i,
    /^where\s+is\s+(?:my\s+)?file\s+(.+)$/i,
    /^find\s+document\s+(.+)$/i,
    /^search\s+documents?\s+(?:for\s+)?(.+)$/i,
  ];
  
  for (const pattern of filePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const fileName = match[1].trim();
      const appName = extractAppName(fileName);
      const cleanFileName = appName 
        ? fileName.replace(new RegExp(`\\s*(on|in|from)\\s+${appName}`, 'gi'), '').trim()
        : fileName;
      
      return {
        intentType: 'searchFile',
        appName,
        query: cleanFileName,
        rawUtterance: utterance,
      };
    }
  }
  
  return null;
}

function parseSearchProfile(utterance: string): ParsedIntent | null {
  const normalized = normalizeText(utterance);
  
  const profilePatterns = [
    /^find\s+(?:the\s+)?profile\s+(?:of\s+|for\s+)?(.+)$/i,
    /^search\s+(?:for\s+)?(?:the\s+)?profile\s+(?:of\s+|for\s+)?(.+)$/i,
    /^look\s+up\s+(.+?)(?:'s)?\s+profile$/i,
    /^find\s+(.+?)\s+on\s+(linkedin|twitter|instagram|facebook|x)$/i,
    /^search\s+(?:for\s+)?(.+?)\s+on\s+(linkedin|twitter|instagram|facebook|x)$/i,
    /^who\s+is\s+(.+)$/i,
  ];
  
  for (const pattern of profilePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      let person = match[1].trim();
      let appName = match[2]?.trim() || extractAppName(normalized);
      
      const cleanPerson = appName 
        ? person.replace(new RegExp(`\\s*(on|from)\\s+${appName}`, 'gi'), '').trim()
        : person;
      
      return {
        intentType: 'searchProfile',
        appName,
        query: cleanPerson,
        rawUtterance: utterance,
      };
    }
  }
  
  return null;
}

export function parseIntent(utterance: string): ParsedIntent {
  if (!utterance || typeof utterance !== 'string') {
    return {
      intentType: 'openApp',
      appName: null,
      query: null,
      rawUtterance: utterance || '',
    };
  }
  
  const trimmedUtterance = utterance.trim();
  
  if (!trimmedUtterance) {
    return {
      intentType: 'openApp',
      appName: null,
      query: null,
      rawUtterance: utterance,
    };
  }
  
  const parsers = [
    parseBookRide,
    parseOrderFood,
    parseSendMessage,
    parseCallContact,
    parseEmailContact,
    parseNavigateTo,
    parsePlayMedia,
    parseSearchFile,
    parseSearchProfile,
    parseSearchApp,
    parseOpenApp,
  ];
  
  for (const parser of parsers) {
    const result = parser(trimmedUtterance);
    if (result) {
      return result;
    }
  }
  
  const appName = extractAppName(trimmedUtterance);
  if (appName) {
    return {
      intentType: 'openApp',
      appName,
      query: null,
      rawUtterance: utterance,
    };
  }
  
  return {
    intentType: 'openApp',
    appName: null,
    query: trimmedUtterance,
    rawUtterance: utterance,
  };
}

export function getIntentDescription(intent: ParsedIntent): string {
  switch (intent.intentType) {
    case 'openApp':
      return intent.appName ? `Open ${intent.appName}` : 'Open app';
    case 'playMedia':
      return intent.query 
        ? (intent.appName ? `Play "${intent.query}" on ${intent.appName}` : `Play "${intent.query}"`)
        : (intent.appName ? `Play media on ${intent.appName}` : 'Play media');
    case 'searchApp':
      return intent.query
        ? (intent.appName ? `Search "${intent.query}" on ${intent.appName}` : `Search for "${intent.query}"`)
        : 'Search';
    case 'sendMessage':
      return intent.query
        ? (intent.messageContent 
            ? `Send message to ${intent.query}: "${intent.messageContent}"`
            : `Send message to ${intent.query}`)
        : 'Send message';
    case 'callContact':
      return intent.query ? `Call ${intent.query}` : 'Make a call';
    case 'emailContact':
      return intent.query
        ? (intent.messageContent
            ? `Email ${intent.query} about "${intent.messageContent}"`
            : `Email ${intent.query}`)
        : 'Compose email';
    case 'navigateTo':
      return intent.query
        ? (intent.appName ? `Navigate to ${intent.query} using ${intent.appName}` : `Navigate to ${intent.query}`)
        : 'Get directions';
    case 'bookRide':
      return intent.query
        ? (intent.appName ? `Book ${intent.appName} to ${intent.query}` : `Book ride to ${intent.query}`)
        : 'Book a ride';
    case 'orderFood':
      return intent.query
        ? (intent.appName ? `Order ${intent.query} from ${intent.appName}` : `Order ${intent.query}`)
        : 'Order food';
    case 'searchFile':
      return intent.query ? `Search for file: ${intent.query}` : 'Search files';
    case 'searchProfile':
      return intent.query
        ? (intent.appName ? `Find ${intent.query} on ${intent.appName}` : `Find profile: ${intent.query}`)
        : 'Search profiles';
    default:
      return intent.rawUtterance;
  }
}

export function getSuggestedApps(intentType: IntentType): string[] {
  switch (intentType) {
    case 'playMedia':
      return MEDIA_APPS;
    case 'sendMessage':
      return MESSAGING_APPS;
    case 'emailContact':
      return EMAIL_APPS;
    case 'navigateTo':
      return NAVIGATION_APPS;
    case 'bookRide':
      return RIDE_SERVICES;
    case 'orderFood':
      return FOOD_SERVICES;
    default:
      return [];
  }
}
