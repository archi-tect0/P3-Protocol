import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parseIntent, parseEndUserIntent } from './services/intent';
import { executeIntent } from './services/executor';
import { 
  getSession as bridgeGetSession,
  startSession as bridgeStartSession
} from './services/sessionBridge';
import { recordQuery } from './services/sessionMemory';
import { synthesizeSpeech, isTTSEnabled, getTTSStatus, type TTSProvider } from './services/voiceSynth';

export const voiceRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const PROVIDER_ALIASES: Record<string, TTSProvider> = {
  'google': 'google-free',
  'google-free': 'google-free',
  'polly': 'polly',
  'aws': 'polly',
  'azure': 'azure',
  'google-cloud': 'google-cloud',
  'gcp': 'google-cloud',
  'openai': 'openai',
  'local': 'google-free',
};

function normalizeProvider(input?: string): TTSProvider | undefined {
  if (!input) return undefined;
  const normalized = input.toLowerCase().trim();
  return PROVIDER_ALIASES[normalized];
}

interface VoiceRequest {
  utterance: string;
  wallet?: string;
  tts?: boolean;
  provider?: string;
  lang?: string;
}

function requireWalletAuth(req: Request, res: Response, next: NextFunction) {
  const atlasUser = (req as any).atlasUser;

  if (!atlasUser || !atlasUser.wallet) {
    res.status(401).json({
      ok: false,
      error: 'Voice endpoints require wallet authentication. Provide a valid Bearer token.',
      'data-testid': 'voice-auth-error',
    });
    return;
  }

  next();
}

voiceRouter.get('/status', (req: Request, res: Response) => {
  const status = getTTSStatus();
  res.json({
    ok: true,
    voice: {
      enabled: true,
      ttsEnabled: status.enabled,
      defaultProvider: status.defaultProvider,
      providers: Object.entries(status.providers).map(([id, p]) => ({
        id,
        available: p.available,
        description: p.description,
      })),
    },
    ts: Date.now(),
    'data-testid': 'voice-status-response',
  });
});

voiceRouter.get('/help', (req: Request, res: Response) => {
  const status = getTTSStatus();
  res.json({
    ok: true,
    help: `Atlas Voice - Natural language interface

Endpoints:
- POST /api/atlas/voice/utter - Process a voice utterance { utterance, tts?, provider?, lang? }
- GET  /api/atlas/voice/status - Check voice/TTS status (public)
- GET  /api/atlas/voice/help - This help message (public)

Example utterances:
- "show my pinned apps"
- "pin Slack"
- "what did I run last"
- "play Spotify"
- "check Slack messages"
- "show me my launcher"

TTS Providers:
- google-free: Free Google Translate TTS (default, no API key)
- polly: Amazon Polly (requires AWS credentials)
- azure: Azure Cognitive Services (requires Azure credentials)
- google-cloud: Google Cloud TTS (requires GCP credentials)
- openai: OpenAI TTS (requires API key)

Provider aliases: google → google-free, aws → polly, gcp → google-cloud`,
    providers: status.providers,
    defaultProvider: status.defaultProvider,
    commands: [
      'POST /api/atlas/voice/utter - Process utterance { utterance, tts?, provider?, lang? }',
      'GET /api/atlas/voice/status - Voice/TTS status (public)',
      'GET /api/atlas/voice/help - Help message (public)',
    ],
    'data-testid': 'voice-help-response',
  });
});

voiceRouter.use(requireWalletAuth);

voiceRouter.post('/utter', async (req: Request, res: Response) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const { utterance, tts = false, provider, lang } = req.body as VoiceRequest;

    if (!utterance || typeof utterance !== 'string') {
      res.status(400).json({
        ok: false,
        error: 'Utterance is required',
        'data-testid': 'voice-utter-error',
      });
      return;
    }

    const trimmedUtterance = utterance.trim();
    if (trimmedUtterance.length === 0) {
      res.status(400).json({
        ok: false,
        error: 'Utterance cannot be empty',
        'data-testid': 'voice-utter-error',
      });
      return;
    }

    recordQuery(wallet, trimmedUtterance);

    let session = bridgeGetSession(wallet);
    if (!session) {
      session = bridgeStartSession(wallet, ['user']);
    }

    const parsedIntent = parseIntent(trimmedUtterance, session.roles[0] || 'user');
    const endUserResult = parseEndUserIntent(trimmedUtterance);
    
    const intent = parsedIntent?.nlIntent || endUserResult.intent;
    const feature = parsedIntent?.feature || endUserResult.feature;
    const params = { ...endUserResult.params, ...parsedIntent?.constraints };

    const canvasModeIntents: Record<string, { message: string; mode: string; pulseView?: 'global' | 'personal' }> = {
      'atlas_hub_open': { message: 'Opening P3 Hub — your living app launcher with real-time metrics.', mode: 'hub' },
      'atlas_pulse_open': { message: 'Opening Atlas Pulse — live substrate health metrics.', mode: 'pulse', pulseView: 'global' },
      'atlas_my_pulse_open': { message: 'Opening your personalized Pulse — metrics for your registered endpoints.', mode: 'pulse', pulseView: 'personal' },
      'atlas_efficiency_open': { message: 'Opening Efficiency Cards — see how Atlas API 2.0 compares to traditional REST.', mode: 'pulse', pulseView: 'global' },
      'atlas_capability_open': { message: 'Here\'s what Atlas can do natively — no AI required. These are deterministic, session-native commands.', mode: 'capability' },
      'atlas_library_open': { message: 'Opening your Library — all your content across videos, games, ebooks, and products.', mode: 'library' },
      'atlas_gamedeck_open': { message: 'Opening Game Deck — your gaming hub.', mode: 'gamedeck' },
      'atlas_media_open': { message: 'Opening Media player.', mode: 'media' },
      'atlas_reader_open': { message: 'Opening Reader for ebooks and documents.', mode: 'reader' },
      'messages_inbox': { message: 'Opening your messages...', mode: 'messages' },
      'messages_compose': { message: 'Opening message composer...', mode: 'messages' },
      'messages_voice_compose': { message: 'Opening voice message composer...', mode: 'messages' },
      'notes_list': { message: 'Opening your notes...', mode: 'notes' },
      'notes_create': { message: 'Opening notes to create a new note...', mode: 'notes' },
      'notes_compose': { message: 'Opening notes to create a new note...', mode: 'notes' },
      'gallery_list': { message: 'Opening your gallery...', mode: 'gallery' },
      'gallery_count': { message: 'Opening your gallery...', mode: 'gallery' },
      'payments_history': { message: 'Opening your payment history...', mode: 'payments' },
      'payments_send': { message: 'Opening payments...', mode: 'payments' },
      'dao_proposals': { message: 'Opening governance proposals...', mode: 'governance' },
      'dao_vote': { message: 'Opening governance to vote...', mode: 'governance' },
      'meta_weather': { message: 'Opening weather...', mode: 'weather' },
      'atlas_one_open': { message: 'Opening Atlas One catalog...', mode: 'one' },
      'atlas_one_catalog': { message: 'Opening Atlas One catalog...', mode: 'one' },
      'gamedeck_open': { message: 'Opening Game Deck...', mode: 'gamedeck' },
      'gamedeck_features': { message: 'Opening Game Deck...', mode: 'gamedeck' },
      'web3_wallet_balance': { message: 'Opening your tokens...', mode: 'tokens' },
      'web3_token_balances': { message: 'Opening your tokens...', mode: 'tokens' },
      'web3_nfts': { message: 'Opening your tokens...', mode: 'tokens' },
      'news_top_stories': { message: 'Opening News — live headlines from around the world.', mode: 'news' },
      'atlas_node_open': { message: 'Starting Pulse Node — become part of the distributed mesh network.', mode: 'node' },
      'atlas_chat_open': { message: 'Opening Atlas Chat — your voice-first assistant.', mode: 'chat' },
    };

    if (intent && canvasModeIntents[intent]) {
      const modeInfo = canvasModeIntents[intent];
      let ttsResponse = null;
      if (tts && isTTSEnabled()) {
        try {
          const normalizedProvider = normalizeProvider(provider);
          ttsResponse = await synthesizeSpeech(modeInfo.message, { 
            provider: normalizedProvider,
            lang: lang || 'en',
          });
        } catch (ttsError) {
          const errMsg = ttsError instanceof Error ? ttsError.message : 'TTS synthesis failed';
          ttsResponse = { error: errMsg };
        }
      }

      res.json({
        ok: true,
        utterance: trimmedUtterance,
        understood: true,
        intent,
        feature,
        message: modeInfo.message,
        canvasMode: modeInfo.mode,
        ...(modeInfo.pulseView && { pulseView: modeInfo.pulseView }),
        tts: ttsResponse,
        session: {
          wallet: session.wallet,
          roles: session.roles,
          connectedApps: session.connectedApps,
        },
        ts: Date.now(),
        'data-testid': 'voice-utter-response',
      });
      return;
    }

    let result: any = {
      understood: true,
      intent,
      feature,
      params,
    };

    if (intent && (intent as string) !== 'unknown') {
      try {
        const executionResult = await executeIntent(
          { intent, feature: feature || '', params },
          { wallet, roles: session.roles }
        );
        result.execution = executionResult;
        result.message = executionResult?.message || `Executed ${intent}`;
      } catch (execError) {
        result.execution = null;
        result.executionError = execError instanceof Error ? execError.message : 'Execution failed';
        result.message = `I understood "${intent}" but couldn't execute it.`;
      }
    } else {
      result.understood = false;
      result.message = `I heard "${trimmedUtterance}" but I'm not sure what you want me to do. Try "show my pinned apps" or "what did I run last".`;
    }

    let ttsResponse = null;
    if (tts && isTTSEnabled()) {
      try {
        const normalizedProvider = normalizeProvider(provider);
        ttsResponse = await synthesizeSpeech(result.message, { 
          provider: normalizedProvider,
          lang: lang || 'en',
        });
      } catch (ttsError) {
        const errMsg = ttsError instanceof Error ? ttsError.message : 'TTS synthesis failed';
        ttsResponse = { error: errMsg };
      }
    }

    res.json({
      ok: true,
      utterance: trimmedUtterance,
      ...result,
      tts: ttsResponse,
      session: {
        wallet: session.wallet,
        roles: session.roles,
        connectedApps: session.connectedApps,
      },
      ts: Date.now(),
      'data-testid': 'voice-utter-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Voice processing failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'voice-utter-error',
    });
  }
});

voiceRouter.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const wallet = req.body.wallet || req.headers['x-wallet-address'];
    const audioFile = req.file;
    
    if (!audioFile) {
      res.status(400).json({
        ok: false,
        error: 'No audio file provided',
        'data-testid': 'transcribe-error',
      });
      return;
    }
    
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      res.status(503).json({
        ok: false,
        error: 'Transcription service not configured',
        'data-testid': 'transcribe-error',
      });
      return;
    }
    
    const formData = new FormData();
    const audioBlob = new Blob([audioFile.buffer], { type: audioFile.mimetype || 'audio/webm' });
    formData.append('file', audioBlob, audioFile.originalname || 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper API error:', errorText);
      res.status(response.status).json({
        ok: false,
        error: 'Transcription failed',
        'data-testid': 'transcribe-error',
      });
      return;
    }
    
    const result = await response.json() as { text?: string };
    
    res.json({
      ok: true,
      text: result.text || '',
      wallet: wallet || null,
      'data-testid': 'transcribe-response',
    });
    
  } catch (error) {
    console.error('Transcription error:', error);
    const message = error instanceof Error ? error.message : 'Transcription failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'transcribe-error',
    });
  }
});
