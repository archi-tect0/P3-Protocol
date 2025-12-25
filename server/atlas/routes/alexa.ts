import { Router, Request, Response } from 'express';
import { getStorageInstance } from '../../storage-accessor';

const router = Router();

interface AlexaRequest {
  wallet?: string;
  utterance: string;
  sessionId?: string;
  locale?: string;
  deviceId?: string;
  previousPlatform?: string;
  isNativeInstall?: boolean;
}

interface AlexaAnalyticsEntry {
  id: string;
  sessionId: string;
  wallet: string | null;
  utterance: string;
  intentMatched: string;
  responseTimeMs: number;
  deviceId: string | null;
  locale: string;
  channel: string;
  previousPlatform: string | null;
  isNativeInstall: boolean;
  isSessionStart: boolean;
  isSessionEnd: boolean;
  timestamp: Date;
}

interface AlexaResponse {
  ok: boolean;
  speech: string;
  displayText?: string;
  visualMode: 'canvas' | 'chat';
  theme: string;
  sessionId: string;
  shouldEndSession: boolean;
  card?: {
    title: string;
    content: string;
    image?: string;
  };
  analytics?: {
    intentMatched?: string;
    responseTimeMs: number;
    source: 'alexa';
  };
}

interface AlexaSession {
  wallet: string;
  createdAt: number;
  lastActivity: number;
  turnCount: number;
  previousPlatform: string | null;
  isNativeInstall: boolean;
}

const alexaSessions = new Map<string, AlexaSession>();
const alexaAnalytics: AlexaAnalyticsEntry[] = [];

router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { 
      wallet, 
      utterance, 
      sessionId, 
      locale, 
      deviceId,
      previousPlatform,
      isNativeInstall 
    } = req.body as AlexaRequest;
    
    if (!utterance || typeof utterance !== 'string') {
      return res.status(400).json({
        ok: false,
        speech: "I didn't catch that. Could you try again?",
        visualMode: 'chat',
        theme: 'line',
        sessionId: sessionId || `alexa-${Date.now()}`,
        shouldEndSession: false,
      });
    }

    let activeSessionId = sessionId;
    let userWallet = wallet;
    let isSessionStart = false;
    let sessionPreviousPlatform: string | null = previousPlatform || null;
    let sessionIsNativeInstall = isNativeInstall || false;
    
    if (sessionId && alexaSessions.has(sessionId)) {
      const session = alexaSessions.get(sessionId)!;
      session.lastActivity = Date.now();
      session.turnCount++;
      userWallet = session.wallet;
      sessionPreviousPlatform = session.previousPlatform;
      sessionIsNativeInstall = session.isNativeInstall;
    } else {
      activeSessionId = `alexa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      isSessionStart = true;
      if (userWallet) {
        alexaSessions.set(activeSessionId, {
          wallet: userWallet,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          turnCount: 1,
          previousPlatform: previousPlatform || null,
          isNativeInstall: isNativeInstall || false,
        });
      }
    }

    let visualMode: 'canvas' | 'chat' = 'chat';
    let theme = 'line';
    
    if (userWallet) {
      try {
        const storage = getStorageInstance();
        const profile = await storage.getWalletProfile(userWallet);
        if (profile) {
          visualMode = (profile.interfacePreference as 'canvas' | 'chat') || 'chat';
          theme = profile.facePreset || 'line';
        }
      } catch (err) {
        console.warn('[Alexa] Failed to load profile:', err);
      }
    }

    const lowerUtterance = utterance.toLowerCase().trim();
    let speech = '';
    let displayText = '';
    let intentMatched = 'general';
    let shouldEndSession = false;
    let card: AlexaResponse['card'] | undefined;

    if (lowerUtterance.includes('hello') || lowerUtterance.includes('hi') || lowerUtterance === 'hey atlas') {
      intentMatched = 'greeting';
      speech = "Hello! I'm Atlas, your voice interface to the P3 mesh. How can I help you today?";
      displayText = "Hello! How can I help?";
    } else if (lowerUtterance.includes('weather')) {
      intentMatched = 'weather';
      try {
        const weatherRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current_weather=true');
        const weatherData = await weatherRes.json() as { current_weather?: { temperature?: number }; current_weather_units?: { temperature?: string } };
        const temp = weatherData.current_weather?.temperature;
        const unit = weatherData.current_weather_units?.temperature || '°C';
        speech = `The current temperature in New York is ${temp} ${unit}.`;
        displayText = `NYC: ${temp}${unit}`;
        card = { title: 'Weather', content: speech };
      } catch {
        speech = "I couldn't fetch the weather right now. Try again in a moment.";
      }
    } else if (lowerUtterance.includes('bitcoin') || lowerUtterance.includes('crypto') || lowerUtterance.includes('ethereum')) {
      intentMatched = 'crypto';
      try {
        const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
        const prices = await cryptoRes.json() as { bitcoin?: { usd?: number }; ethereum?: { usd?: number } };
        const btc = prices.bitcoin?.usd?.toLocaleString() || 'unknown';
        const eth = prices.ethereum?.usd?.toLocaleString() || 'unknown';
        speech = `Bitcoin is at $${btc} and Ethereum is at $${eth}.`;
        displayText = `BTC: $${btc} | ETH: $${eth}`;
        card = { title: 'Crypto Prices', content: speech };
      } catch {
        speech = "I couldn't fetch crypto prices right now.";
      }
    } else if (lowerUtterance.includes('help') || lowerUtterance.includes('what can you do')) {
      intentMatched = 'help';
      speech = "I can check weather, crypto prices, help you navigate apps, and more. Just ask me anything!";
      displayText = "Ask about weather, crypto, or apps";
    } else if (lowerUtterance.includes('goodbye') || lowerUtterance.includes('bye') || lowerUtterance.includes('exit')) {
      intentMatched = 'goodbye';
      speech = "Goodbye! See you next time on the P3 mesh.";
      shouldEndSession = true;
    } else if (lowerUtterance.includes('switch to canvas') || lowerUtterance.includes('canvas mode')) {
      intentMatched = 'mode_switch';
      visualMode = 'canvas';
      speech = "Switching to Canvas mode. Your tiles are ready.";
      if (userWallet) {
        try {
          const storage = getStorageInstance();
          await storage.upsertWalletProfile({ wallet: userWallet, interfacePreference: 'canvas' });
        } catch {}
      }
    } else if (lowerUtterance.includes('switch to chat') || lowerUtterance.includes('chat mode')) {
      intentMatched = 'mode_switch';
      visualMode = 'chat';
      speech = "Switching to Chat mode. I'm ready to talk.";
      if (userWallet) {
        try {
          const storage = getStorageInstance();
          await storage.upsertWalletProfile({ wallet: userWallet, interfacePreference: 'chat' });
        } catch {}
      }
    } else {
      intentMatched = 'general';
      speech = `I heard "${utterance}". I'm still learning new skills. Try asking about weather or crypto prices.`;
      displayText = utterance;
    }

    const responseTimeMs = Date.now() - startTime;

    const analyticsEntry: AlexaAnalyticsEntry = {
      id: `alexa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: activeSessionId!,
      wallet: userWallet || null,
      utterance,
      intentMatched,
      responseTimeMs,
      deviceId: deviceId || null,
      locale: locale || 'en-US',
      channel: 'alexa',
      previousPlatform: sessionPreviousPlatform,
      isNativeInstall: sessionIsNativeInstall,
      isSessionStart,
      isSessionEnd: shouldEndSession,
      timestamp: new Date(),
    };
    
    alexaAnalytics.push(analyticsEntry);
    if (alexaAnalytics.length > 10000) {
      alexaAnalytics.splice(0, 1000);
    }

    const response: AlexaResponse = {
      ok: true,
      speech,
      displayText: displayText || speech,
      visualMode,
      theme,
      sessionId: activeSessionId!,
      shouldEndSession,
      card,
      analytics: {
        intentMatched,
        responseTimeMs,
        source: 'alexa',
      },
    };

    res.json(response);
  } catch (error) {
    console.error('[Alexa] Error processing request:', error);
    res.status(500).json({
      ok: false,
      speech: "Something went wrong. Please try again.",
      visualMode: 'chat',
      theme: 'line',
      sessionId: `alexa-error-${Date.now()}`,
      shouldEndSession: false,
    });
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'atlas-alexa',
    activeSessions: alexaSessions.size,
    timestamp: Date.now(),
  });
});

router.get('/metrics', (_req: Request, res: Response) => {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  
  const last24h = alexaAnalytics.filter(a => a.timestamp.getTime() > oneDayAgo);
  const lastHour = alexaAnalytics.filter(a => a.timestamp.getTime() > oneHourAgo);
  
  const uniqueWallets = new Set(last24h.filter(a => a.wallet).map(a => a.wallet));
  const uniqueSessions = new Set(last24h.map(a => a.sessionId));
  
  const intentCounts: Record<string, number> = {};
  last24h.forEach(a => {
    intentCounts[a.intentMatched] = (intentCounts[a.intentMatched] || 0) + 1;
  });
  
  const platformHandoffs = last24h.filter(a => a.previousPlatform).reduce((acc, a) => {
    const key = `${a.previousPlatform} → alexa`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const nativeInstalls = last24h.filter(a => a.isNativeInstall).length;
  const webAccess = last24h.filter(a => !a.isNativeInstall).length;
  
  const avgResponseTime = last24h.length > 0 
    ? Math.round(last24h.reduce((sum, a) => sum + a.responseTimeMs, 0) / last24h.length) 
    : 0;
  
  res.json({
    ok: true,
    metrics: {
      totalRequests24h: last24h.length,
      totalRequestsHour: lastHour.length,
      uniqueWallets: uniqueWallets.size,
      uniqueSessions: uniqueSessions.size,
      avgResponseTimeMs: avgResponseTime,
      intentBreakdown: intentCounts,
      platformHandoffs,
      installType: {
        native: nativeInstalls,
        web: webAccess,
      },
      activeSessions: alexaSessions.size,
    },
    timestamp: Date.now(),
  });
});

router.get('/sessions', (_req: Request, res: Response) => {
  const sessions = Array.from(alexaSessions.entries()).map(([id, session]) => ({
    sessionId: id,
    wallet: session.wallet ? `${session.wallet.slice(0, 6)}...${session.wallet.slice(-4)}` : null,
    turnCount: session.turnCount,
    durationMs: Date.now() - session.createdAt,
    previousPlatform: session.previousPlatform,
    isNativeInstall: session.isNativeInstall,
  }));
  
  res.json({
    ok: true,
    sessions,
    count: sessions.length,
  });
});

router.post('/disconnect', (req: Request, res: Response) => {
  const { sessionId, wallet } = req.body;
  
  if (sessionId && alexaSessions.has(sessionId)) {
    alexaSessions.delete(sessionId);
    res.json({ ok: true, message: 'Session disconnected' });
  } else if (wallet) {
    let disconnected = 0;
    for (const [id, session] of alexaSessions.entries()) {
      if (session.wallet.toLowerCase() === wallet.toLowerCase()) {
        alexaSessions.delete(id);
        disconnected++;
      }
    }
    res.json({ ok: true, message: `Disconnected ${disconnected} session(s)` });
  } else {
    res.status(400).json({ ok: false, error: 'Provide sessionId or wallet to disconnect' });
  }
});

export default router;
