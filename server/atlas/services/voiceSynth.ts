import googleTTS from 'google-tts-api';

export type TTSProvider = 'google-free' | 'polly' | 'azure' | 'google-cloud' | 'openai';

export interface TTSOptions {
  provider?: TTSProvider;
  voice?: string;
  lang?: string;
  slow?: boolean;
}

export interface TTSResult {
  provider: TTSProvider;
  audioUrl?: string;
  audioBase64?: string;
  contentType: string;
  duration?: number;
  cached?: boolean;
  segments?: { url: string; text: string }[];
}

interface ProviderConfig {
  enabled: boolean;
  envVars: string[];
  description: string;
}

const providerConfigs: Record<TTSProvider, ProviderConfig> = {
  'google-free': {
    enabled: true,
    envVars: [],
    description: 'Free Google Translate TTS (no API key required)',
  },
  polly: {
    enabled: false,
    envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
    description: 'Amazon Polly (5M chars/month free tier)',
  },
  azure: {
    enabled: false,
    envVars: ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION'],
    description: 'Azure Cognitive Services (500K chars/month free)',
  },
  'google-cloud': {
    enabled: false,
    envVars: ['GOOGLE_APPLICATION_CREDENTIALS'],
    description: 'Google Cloud TTS (4M chars/month free)',
  },
  openai: {
    enabled: false,
    envVars: ['OPENAI_API_KEY'],
    description: 'OpenAI TTS (paid, high quality)',
  },
};

function checkProviderEnv(provider: TTSProvider): boolean {
  const config = providerConfigs[provider];
  if (!config) return false;
  
  if (provider === 'google-free') {
    return true;
  }
  
  return config.envVars.every(envVar => !!process.env[envVar]);
}

export function getAvailableProviders(): TTSProvider[] {
  return (Object.keys(providerConfigs) as TTSProvider[]).filter(checkProviderEnv);
}

export function isTTSEnabled(): boolean {
  return getAvailableProviders().length > 0;
}

export function getDefaultProvider(): TTSProvider | null {
  const available = getAvailableProviders();
  if (available.length === 0) return null;
  
  if (available.includes('google-free')) {
    return 'google-free';
  }
  
  const priority: TTSProvider[] = ['openai', 'google-cloud', 'polly', 'azure'];
  for (const provider of priority) {
    if (available.includes(provider)) {
      return provider;
    }
  }
  
  return available[0];
}

async function synthesizeGoogleFree(text: string, options: TTSOptions): Promise<TTSResult> {
  const lang = options.lang || 'en';
  const slow = options.slow || false;
  
  if (text.length <= 200) {
    const url = googleTTS.getAudioUrl(text, {
      lang,
      slow,
      host: 'https://translate.google.com',
    });
    
    return {
      provider: 'google-free',
      audioUrl: url,
      contentType: 'audio/mpeg',
      cached: false,
    };
  }
  
  const allUrls = googleTTS.getAllAudioUrls(text, {
    lang,
    slow,
    host: 'https://translate.google.com',
    splitPunct: ',.?!;:',
  });
  
  return {
    provider: 'google-free',
    audioUrl: allUrls[0]?.url,
    contentType: 'audio/mpeg',
    cached: false,
    segments: allUrls.map(u => ({ url: u.url, text: u.shortText })),
  };
}

async function synthesizePolly(text: string, options: TTSOptions): Promise<TTSResult> {
  throw new Error('AWS Polly not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.');
}

async function synthesizeAzure(text: string, options: TTSOptions): Promise<TTSResult> {
  throw new Error('Azure Speech not configured. Set AZURE_SPEECH_KEY, AZURE_SPEECH_REGION.');
}

async function synthesizeGoogleCloud(text: string, options: TTSOptions): Promise<TTSResult> {
  throw new Error('Google Cloud TTS not configured. Set GOOGLE_APPLICATION_CREDENTIALS.');
}

async function synthesizeOpenAI(text: string, options: TTSOptions): Promise<TTSResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI not configured. Set OPENAI_API_KEY.');
  }
  
  const voice = options.voice || 'alloy';
  
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice,
      response_format: 'mp3',
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI TTS failed: ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  
  return {
    provider: 'openai',
    audioBase64: base64,
    contentType: 'audio/mpeg',
    cached: false,
  };
}

export async function synthesizeSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResult> {
  const provider = options.provider || getDefaultProvider();
  
  if (!provider) {
    throw new Error('No TTS provider available.');
  }
  
  if (!checkProviderEnv(provider)) {
    throw new Error(`TTS provider "${provider}" is not configured. Check environment variables.`);
  }
  
  switch (provider) {
    case 'google-free':
      return synthesizeGoogleFree(text, options);
    case 'polly':
      return synthesizePolly(text, options);
    case 'azure':
      return synthesizeAzure(text, options);
    case 'google-cloud':
      return synthesizeGoogleCloud(text, options);
    case 'openai':
      return synthesizeOpenAI(text, options);
    default:
      throw new Error(`Unknown TTS provider: ${provider}`);
  }
}

export function getTTSStatus(): {
  enabled: boolean;
  providers: Record<TTSProvider, { available: boolean; envVars: string[]; description: string }>;
  defaultProvider: TTSProvider | null;
} {
  const providers: Record<TTSProvider, { available: boolean; envVars: string[]; description: string }> = {} as any;
  
  for (const [provider, config] of Object.entries(providerConfigs)) {
    providers[provider as TTSProvider] = {
      available: checkProviderEnv(provider as TTSProvider),
      envVars: config.envVars,
      description: config.description,
    };
  }
  
  return {
    enabled: isTTSEnabled(),
    providers,
    defaultProvider: getDefaultProvider(),
  };
}
