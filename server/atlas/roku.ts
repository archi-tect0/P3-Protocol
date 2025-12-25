import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';

const router = Router();

// In-memory store for Roku sessions (production would use Redis)
interface RokuSession {
  sessionId: string;
  pairingCode: string;
  device: string;
  model: string;
  createdAt: number;
  expiresAt: number;
  paired: boolean;
  walletAddress?: string;
  token?: string;
  pinHash?: string; // Optional PIN for quick unlock after pairing
  pinAttempts?: number;
  pinLockedUntil?: number;
}

const rokuSessions = new Map<string, RokuSession>();
const pairingCodes = new Map<string, string>(); // code -> sessionId

// Rate limiting for pairing attempts
const pairingAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_PAIRING_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_PIN_ATTEMPTS = 3;
const PIN_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Generate cryptographically secure 6-digit pairing code
function generatePairingCode(): string {
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0) % 900000 + 100000;
  return num.toString();
}

// Hash PIN with salt for secure storage
function hashPin(pin: string, sessionId: string): string {
  return crypto.createHash('sha256')
    .update(pin + sessionId + 'atlas-roku-pin-salt')
    .digest('hex');
}

// Verify PIN against stored hash
function verifyPin(pin: string, sessionId: string, storedHash: string): boolean {
  const inputHash = hashPin(pin, sessionId);
  return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(storedHash));
}

// Check rate limit for pairing attempts
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = pairingAttempts.get(ip);
  
  if (!record || record.resetAt < now) {
    pairingAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= MAX_PAIRING_ATTEMPTS) {
    return false;
  }
  
  record.count++;
  return true;
}

// Get stats for monitoring
export function getRokuSessionStats() {
  const now = Date.now();
  let activeUnpaired = 0;
  let activePaired = 0;
  const uniqueWallets = new Set<string>();
  
  for (const session of rokuSessions.values()) {
    if (session.expiresAt > now) {
      if (session.paired) {
        activePaired++;
        if (session.walletAddress) {
          uniqueWallets.add(session.walletAddress.toLowerCase());
        }
      } else {
        activeUnpaired++;
      }
    }
  }
  
  return {
    totalSessions: rokuSessions.size,
    activeUnpaired,
    activePaired,
    connectedWallets: uniqueWallets.size
  };
}

// Generate session ID
function generateSessionId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Generate device token
function generateDeviceToken(sessionId: string): string {
  return crypto.createHash('sha256')
    .update(sessionId + Date.now().toString() + crypto.randomBytes(8).toString('hex'))
    .digest('hex');
}

// Clean expired sessions (now cleans paired sessions too)
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of rokuSessions.entries()) {
    if (session.expiresAt < now) {
      rokuSessions.delete(id);
      if (!session.paired) {
        pairingCodes.delete(session.pairingCode);
      }
    }
  }
}

// POST /api/atlas/roku/session/start - Create new Roku session
router.post('/session/start', (req: Request, res: Response) => {
  try {
    cleanExpiredSessions();
    
    const { device = 'roku', model = 'unknown' } = req.body;
    
    const sessionId = generateSessionId();
    const pairingCode = generatePairingCode();
    const token = generateDeviceToken(sessionId);
    
    const session: RokuSession = {
      sessionId,
      pairingCode,
      device,
      model,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute expiry for pairing
      paired: false,
      token
    };
    
    rokuSessions.set(sessionId, session);
    pairingCodes.set(pairingCode, sessionId);
    
    console.log(`[Roku] New session created: ${sessionId.slice(0, 8)}... code: ${pairingCode}`);
    
    res.json({
      sessionId,
      pairingCode,
      token,
      expiresIn: 300, // seconds
      pairUrl: `https://p3protocol.com/atlas/pair?code=${pairingCode}`
    });
  } catch (error) {
    console.error('[Roku] Session start error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// POST /api/atlas/roku/session/:id/bind - Pair Roku to user session (requires token)
router.post('/session/:id/bind', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pairingCode, walletAddress, token } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Rate limit binding attempts
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a minute.' });
    }
    
    // Find session by ID or by pairing code
    let session = rokuSessions.get(id);
    
    if (!session && pairingCode) {
      const sessionId = pairingCodes.get(pairingCode);
      if (sessionId) {
        session = rokuSessions.get(sessionId);
      }
    }
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // SECURITY: Require valid session token to bind
    // This prevents session hijacking via guessed/leaked session IDs
    if (!token || token !== session.token) {
      return res.status(403).json({ error: 'Invalid session token' });
    }
    
    if (session.expiresAt < Date.now() && !session.paired) {
      rokuSessions.delete(session.sessionId);
      pairingCodes.delete(session.pairingCode);
      return res.status(410).json({ error: 'Pairing code expired' });
    }
    
    // Bind wallet to session
    session.paired = true;
    session.walletAddress = walletAddress;
    session.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hour session after pairing
    
    pairingCodes.delete(session.pairingCode); // Code is now used
    
    console.log(`[Roku] Session paired: ${session.sessionId.slice(0, 8)}... wallet: ${walletAddress?.slice(0, 10)}...`);
    
    res.json({
      ok: true,
      sessionId: session.sessionId,
      paired: true,
      walletAddress: session.walletAddress
    });
  } catch (error) {
    console.error('[Roku] Session bind error:', error);
    res.status(500).json({ error: 'Failed to bind session' });
  }
});

// GET /api/atlas/roku/session/:id/status - Check session status (token required)
router.get('/session/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    const session = rokuSessions.get(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // SECURITY: Require valid session token to check status
    // This prevents session ID enumeration attacks
    if (!token || token !== session.token) {
      return res.status(403).json({ error: 'Invalid session token' });
    }
    
    // Enforce expiry check
    if (session.expiresAt < Date.now()) {
      rokuSessions.delete(id);
      return res.status(410).json({ error: 'Session expired' });
    }
    
    res.json({
      sessionId: session.sessionId,
      paired: session.paired,
      walletAddress: session.walletAddress ? `${session.walletAddress.slice(0, 6)}...${session.walletAddress.slice(-4)}` : null,
      expiresIn: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// POST /api/atlas/roku/session/:id/command - Send command to Roku (token required)
router.post('/session/:id/command', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = rokuSessions.get(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // SECURITY: Require valid session token for all commands
    const { token } = req.body;
    if (!token || token !== session.token) {
      return res.status(403).json({ error: 'Invalid session token' });
    }
    
    // Enforce expiry check
    if (session.expiresAt < Date.now()) {
      rokuSessions.delete(id);
      return res.status(410).json({ error: 'Session expired' });
    }
    
    // Security: Only accept commands for paired sessions
    if (!session.paired) {
      return res.status(403).json({ error: 'Session not paired yet' });
    }
    
    const command = req.body;
    
    // In production, this would push to WebSocket/SSE channel
    // For now, just log and acknowledge
    console.log(`[Roku] Command for session ${id.slice(0, 8)}...:`, command.type);
    
    // SECURITY FIX: Do NOT allow wallet mutation from command endpoint
    // Wallet can only be set during authenticated pairing flow
    
    res.json({ ok: true, received: command.type });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process command' });
  }
});

// GET /api/atlas/roku/pair - Web pairing page (returns pairing UI info)
router.get('/pair', (req: Request, res: Response) => {
  const { code } = req.query;
  
  if (code && typeof code === 'string') {
    const sessionId = pairingCodes.get(code);
    if (sessionId) {
      const session = rokuSessions.get(sessionId);
      if (session && session.expiresAt > Date.now()) {
        return res.json({
          valid: true,
          device: session.device,
          model: session.model,
          expiresIn: Math.floor((session.expiresAt - Date.now()) / 1000)
        });
      }
    }
    return res.json({ valid: false, error: 'Invalid or expired code' });
  }
  
  res.json({
    endpoint: '/api/atlas/roku/session/:id/bind',
    method: 'POST',
    body: { pairingCode: 'string', walletAddress: 'string' }
  });
});

// POST /api/atlas/roku/pair - Bind by pairing code (requires token for security)
router.post('/pair', (req: Request, res: Response) => {
  try {
    const { code, walletAddress, token: deviceToken, sessionId: providedSessionId } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Rate limit pairing attempts
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many pairing attempts. Please wait a minute.' });
    }
    
    if (!code) {
      return res.status(400).json({ error: 'Pairing code required' });
    }
    
    // SECURITY: Device token is REQUIRED for pairing
    // This prevents code phishing - attacker needs both code AND device token
    // Token is obtained by scanning QR code or from the Roku device directly
    if (!deviceToken) {
      return res.status(400).json({ 
        error: 'Device token required. Scan the QR code on your TV or use the Atlas app.',
        code: 'TOKEN_REQUIRED'
      });
    }
    
    const sessionId = pairingCodes.get(code);
    if (!sessionId) {
      return res.status(404).json({ error: 'Invalid pairing code' });
    }
    
    const session = rokuSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // SECURITY: Validate device token
    if (deviceToken !== session.token) {
      return res.status(403).json({ error: 'Invalid device token' });
    }
    
    // SECURITY: Validate session ID if provided (from QR code)
    if (providedSessionId && providedSessionId !== sessionId) {
      return res.status(403).json({ error: 'Session ID mismatch' });
    }
    
    if (session.expiresAt < Date.now() && !session.paired) {
      pairingCodes.delete(code);
      rokuSessions.delete(sessionId);
      return res.status(410).json({ error: 'Pairing code expired' });
    }
    
    // Bind
    session.paired = true;
    session.walletAddress = walletAddress;
    session.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    pairingCodes.delete(code);
    
    console.log(`[Roku] Paired via code: ${code} -> ${sessionId.slice(0, 8)}...`);
    
    res.json({
      ok: true,
      sessionId: session.sessionId,
      token: session.token, // Return token for client storage
      message: 'Roku paired successfully! You can now use Atlas on your TV.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pair' });
  }
});

// GET /api/atlas/roku/stats - Get session stats for monitoring
router.get('/stats', (req: Request, res: Response) => {
  try {
    cleanExpiredSessions();
    const stats = getRokuSessionStats();
    res.json({
      ok: true,
      ...stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/atlas/roku/session/:id/qr - Get QR code for pairing (requires token auth)
router.get('/session/:id/qr', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    const session = rokuSessions.get(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // SECURITY: Require valid session token to access QR code
    if (!token || token !== session.token) {
      return res.status(403).json({ error: 'Invalid session token' });
    }
    
    if (session.paired) {
      return res.status(400).json({ error: 'Session already paired' });
    }
    
    if (session.expiresAt < Date.now()) {
      rokuSessions.delete(id);
      return res.status(410).json({ error: 'Session expired' });
    }
    
    // Generate QR code URL - encode session ID, code, and full token for secure pairing
    // Mobile app scans this and can pair securely with all required credentials
    const qrPayload = `atlas://pair?s=${id}&c=${session.pairingCode}&t=${session.token}`;
    
    // Generate QR code as data URL (PNG)
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 2,
      color: {
        dark: '#FFFFFF',
        light: '#000000'
      }
    });
    
    // SECURITY: Don't return raw pairing code in JSON response
    res.json({
      ok: true,
      qrCode: qrDataUrl,
      expiresIn: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000))
    });
  } catch (error) {
    console.error('[Roku] QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// GET /api/atlas/roku/session/:id/qr.png - Get QR code as image for Roku display (requires token)
router.get('/session/:id/qr.png', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    const session = rokuSessions.get(id);
    
    if (!session) {
      res.status(404).send('Session not found');
      return;
    }
    
    // SECURITY: Require valid session token
    if (!token || token !== session.token) {
      res.status(403).send('Invalid token');
      return;
    }
    
    if (session.paired || session.expiresAt < Date.now()) {
      res.status(410).send('Session expired or already paired');
      return;
    }
    
    // Encode all required credentials for secure pairing
    const qrPayload = `atlas://pair?s=${id}&c=${session.pairingCode}&t=${session.token}`;
    
    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      width: 400,
      margin: 2,
      color: {
        dark: '#FFFFFF',
        light: '#1a1a2e'
      }
    });
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(qrBuffer);
  } catch (error) {
    res.status(500).send('Failed to generate QR');
  }
});

// POST /api/atlas/roku/session/:id/pin/set - Set PIN for quick unlock (post-pair only, token required)
router.post('/session/:id/pin/set', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pin, walletAddress, token } = req.body;
    const session = rokuSessions.get(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // SECURITY: Require valid session token for PIN operations
    if (!token || token !== session.token) {
      return res.status(403).json({ error: 'Invalid session token' });
    }
    
    // Security: Only allow PIN setup for paired sessions
    if (!session.paired) {
      return res.status(403).json({ error: 'Must pair device first before setting PIN' });
    }
    
    // Security: Verify wallet ownership
    if (session.walletAddress?.toLowerCase() !== walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: 'Wallet address mismatch' });
    }
    
    // Validate PIN format (4-6 digits)
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }
    
    // Store hashed PIN
    session.pinHash = hashPin(pin, id);
    session.pinAttempts = 0;
    session.pinLockedUntil = undefined;
    
    console.log(`[Roku] PIN set for session ${id.slice(0, 8)}...`);
    
    res.json({
      ok: true,
      message: 'PIN set successfully. You can now unlock your Roku with this PIN.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set PIN' });
  }
});

// POST /api/atlas/roku/session/:id/pin/verify - Verify PIN for quick unlock (token required)
router.post('/session/:id/pin/verify', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pin, token } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const session = rokuSessions.get(id);
    
    // SECURITY: Rate limit PIN attempts per IP (prevents distributed guessing)
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a minute.' });
    }
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // SECURITY: Require valid session token for PIN verification
    if (!token || token !== session.token) {
      return res.status(403).json({ error: 'Invalid session token' });
    }
    
    // SECURITY: Check session expiry before any PIN operations
    if (session.expiresAt < Date.now()) {
      rokuSessions.delete(id);
      return res.status(410).json({ error: 'Session expired' });
    }
    
    if (!session.paired) {
      return res.status(403).json({ error: 'Session not paired' });
    }
    
    // SECURITY: Ensure wallet is present before extending session
    if (!session.walletAddress) {
      return res.status(403).json({ error: 'Session has no wallet bound' });
    }
    
    // SECURITY: Safe check for missing PIN hash (prevents crash/DoS)
    if (!session.pinHash || typeof session.pinHash !== 'string' || session.pinHash.length !== 64) {
      return res.status(400).json({ error: 'No PIN set for this session' });
    }
    
    // Check lockout
    if (session.pinLockedUntil && session.pinLockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((session.pinLockedUntil - Date.now()) / 60000);
      return res.status(429).json({ 
        error: `Too many attempts. Try again in ${remainingMinutes} minute(s).`,
        lockedUntil: session.pinLockedUntil
      });
    }
    
    // SECURITY: Validate PIN format before verification
    if (!pin || typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'Invalid PIN format' });
    }
    
    // Verify PIN with timing-safe comparison
    let isValid = false;
    try {
      isValid = verifyPin(pin, id, session.pinHash);
    } catch (e) {
      // Catch any crypto errors gracefully
      return res.status(500).json({ error: 'PIN verification error' });
    }
    
    if (!isValid) {
      session.pinAttempts = (session.pinAttempts || 0) + 1;
      
      if (session.pinAttempts >= MAX_PIN_ATTEMPTS) {
        session.pinLockedUntil = Date.now() + PIN_LOCKOUT_DURATION;
        session.pinAttempts = 0;
        return res.status(429).json({ 
          error: 'Too many incorrect attempts. PIN locked for 15 minutes.',
          lockedUntil: session.pinLockedUntil
        });
      }
      
      return res.status(401).json({ 
        error: 'Incorrect PIN',
        attemptsRemaining: MAX_PIN_ATTEMPTS - session.pinAttempts
      });
    }
    
    // Success - reset attempts and extend session (only if still valid)
    session.pinAttempts = 0;
    session.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // Extend by 24h
    
    console.log(`[Roku] PIN verified for session ${id.slice(0, 8)}...`);
    
    res.json({
      ok: true,
      walletAddress: session.walletAddress,
      message: 'PIN verified. Welcome back!'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

// DELETE /api/atlas/roku/session/:id/pin - Remove PIN (token required)
router.delete('/session/:id/pin', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { walletAddress, token } = req.body;
    const session = rokuSessions.get(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // SECURITY: Require valid session token
    if (!token || token !== session.token) {
      return res.status(403).json({ error: 'Invalid session token' });
    }
    
    // Security: Verify wallet ownership
    if (session.walletAddress?.toLowerCase() !== walletAddress?.toLowerCase()) {
      return res.status(403).json({ error: 'Wallet address mismatch' });
    }
    
    session.pinHash = undefined;
    session.pinAttempts = undefined;
    session.pinLockedUntil = undefined;
    
    res.json({ ok: true, message: 'PIN removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove PIN' });
  }
});

// GET /api/atlas/roku/session/:id/pin/status - Check if PIN is set (token required)
router.get('/session/:id/pin/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    const session = rokuSessions.get(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // SECURITY: Require valid session token
    if (!token || token !== session.token) {
      return res.status(403).json({ error: 'Invalid session token' });
    }
    
    res.json({
      ok: true,
      hasPin: !!session.pinHash,
      isLocked: session.pinLockedUntil ? session.pinLockedUntil > Date.now() : false,
      lockedUntil: session.pinLockedUntil && session.pinLockedUntil > Date.now() ? session.pinLockedUntil : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get PIN status' });
  }
});

export default router;
