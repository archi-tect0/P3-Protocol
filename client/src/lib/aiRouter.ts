import { deriveKey, decryptJson, getVaultToken } from './vault';

type ProviderId = 'openai' | 'anthropic' | 'gemini';
type Message = { role: 'user' | 'assistant' | 'system'; content: string };

interface ProviderConfig {
  apiKey: string;
  model: string;
}

interface AIResponse {
  provider: ProviderId;
  reply: string;
  model: string;
  error?: string;
}

async function loadProviderConfig(key: CryptoKey, id: ProviderId): Promise<ProviderConfig | null> {
  const envelope = await getVaultToken(`dev-${id}`);
  if (!envelope) return null;
  try {
    return await decryptJson(key, envelope);
  } catch {
    return null;
  }
}

async function loadMultiMode(key: CryptoKey): Promise<boolean> {
  const envelope = await getVaultToken('dev-multiai');
  if (!envelope) return false;
  try {
    const cfg = await decryptJson(key, envelope);
    return !!cfg?.enabled;
  } catch {
    return false;
  }
}

export async function runAI(
  walletAddress: string,
  signature: string,
  prompt: string,
  systemPrompt?: string
): Promise<AIResponse[]> {
  const key = await deriveKey(walletAddress, signature);
  const multiMode = await loadMultiMode(key);
  
  const providers: ProviderId[] = ['openai', 'anthropic', 'gemini'];
  const messages: Message[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const calls: Promise<AIResponse>[] = [];
  
  for (const providerId of providers) {
    const cfg = await loadProviderConfig(key, providerId);
    if (!cfg?.apiKey) continue;
    
    const endpoint = `/api/ai/${providerId}/chat`;
    
    const callPromise = fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'x-api-key': cfg.apiKey 
      },
      body: JSON.stringify({ messages, model: cfg.model })
    })
    .then(async r => {
      const data = await r.json();
      return {
        provider: providerId,
        reply: data.reply || '',
        model: cfg.model,
        error: data.error
      };
    })
    .catch(err => ({
      provider: providerId,
      reply: '',
      model: cfg.model,
      error: err.message
    }));
    
    calls.push(callPromise);
    
    if (!multiMode) break;
  }

  if (calls.length === 0) {
    return [{ provider: 'openai', reply: '', model: '', error: 'No AI providers configured' }];
  }

  return Promise.all(calls);
}

export async function getConfiguredProviders(
  walletAddress: string,
  signature: string
): Promise<ProviderId[]> {
  const key = await deriveKey(walletAddress, signature);
  const providers: ProviderId[] = ['openai', 'anthropic', 'gemini'];
  const configured: ProviderId[] = [];
  
  for (const id of providers) {
    const cfg = await loadProviderConfig(key, id);
    if (cfg?.apiKey) {
      configured.push(id);
    }
  }
  
  return configured;
}

export async function isMultiModeEnabled(
  walletAddress: string,
  signature: string
): Promise<boolean> {
  const key = await deriveKey(walletAddress, signature);
  return loadMultiMode(key);
}
