/**
 * Proof-of-Work Anti-Sybil Middleware
 * 
 * Requires clients to solve a small computational puzzle before
 * accessing expensive relay endpoints. This prevents Sybil attacks
 * where malicious users flood the mesh with garbage packets.
 * 
 * Algorithm: Hashcash-style SHA-256 with configurable difficulty
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Difficulty levels (leading zero bits required)
export const POW_DIFFICULTY = {
  LOW: 16,      // ~65k hashes, <100ms on modern hardware
  MEDIUM: 20,   // ~1M hashes, ~1s on modern hardware
  HIGH: 24,     // ~16M hashes, ~15s on modern hardware
};

// Challenge expiry (5 minutes)
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

// In-memory challenge store (use Redis in production)
const challenges = new Map<string, { challenge: string; expiresAt: number; difficulty: number }>();

// Cleanup expired challenges periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of challenges.entries()) {
    if (value.expiresAt < now) {
      challenges.delete(key);
    }
  }
}, 60000); // Every minute

/**
 * Generate a PoW challenge for a client
 */
export function generateChallenge(clientId: string, difficulty: number = POW_DIFFICULTY.LOW): {
  challenge: string;
  difficulty: number;
  expiresAt: number;
} {
  const challenge = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + CHALLENGE_EXPIRY_MS;
  
  challenges.set(clientId, { challenge, expiresAt, difficulty });
  
  return { challenge, difficulty, expiresAt };
}

/**
 * Verify a PoW solution
 */
export function verifySolution(
  clientId: string, 
  challenge: string, 
  nonce: string
): { valid: boolean; error?: string } {
  const stored = challenges.get(clientId);
  
  if (!stored) {
    return { valid: false, error: 'No challenge found. Request a new challenge.' };
  }
  
  if (stored.expiresAt < Date.now()) {
    challenges.delete(clientId);
    return { valid: false, error: 'Challenge expired. Request a new challenge.' };
  }
  
  if (stored.challenge !== challenge) {
    return { valid: false, error: 'Challenge mismatch.' };
  }
  
  // Verify the hash meets difficulty requirement
  const hash = crypto.createHash('sha256')
    .update(challenge + nonce)
    .digest();
  
  const leadingZeros = countLeadingZeroBits(hash);
  
  if (leadingZeros >= stored.difficulty) {
    // Solution valid - remove challenge to prevent reuse
    challenges.delete(clientId);
    return { valid: true };
  }
  
  return { 
    valid: false, 
    error: `Insufficient work. Need ${stored.difficulty} leading zero bits, got ${leadingZeros}.` 
  };
}

/**
 * Count leading zero bits in a buffer
 */
function countLeadingZeroBits(buffer: Buffer): number {
  let zeros = 0;
  
  for (const byte of buffer) {
    if (byte === 0) {
      zeros += 8;
    } else {
      // Count leading zeros in this byte
      let mask = 0x80;
      while ((byte & mask) === 0 && mask > 0) {
        zeros++;
        mask >>= 1;
      }
      break;
    }
  }
  
  return zeros;
}

/**
 * Get client identifier from request
 */
function getClientId(req: Request): string {
  // Prefer wallet address if available
  const wallet = req.headers['x-wallet'] as string;
  if (wallet) {
    return `wallet:${wallet.toLowerCase()}`;
  }
  
  // Fall back to IP
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.socket.remoteAddress || '127.0.0.1';
  
  return `ip:${ip}`;
}

/**
 * Express middleware to require PoW for expensive operations
 * 
 * Usage:
 * ```typescript
 * import { requirePoW, POW_DIFFICULTY } from './middleware/pow';
 * 
 * app.post('/api/relay/heavy-operation', 
 *   requirePoW(POW_DIFFICULTY.MEDIUM),
 *   (req, res) => { ... }
 * );
 * ```
 */
export function requirePoW(difficulty: number = POW_DIFFICULTY.LOW) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = getClientId(req);
    
    // Check for PoW headers
    const powChallenge = req.headers['x-pow-challenge'] as string;
    const powNonce = req.headers['x-pow-nonce'] as string;
    
    if (!powChallenge || !powNonce) {
      // No PoW provided - issue a challenge
      const { challenge, difficulty: diff, expiresAt } = generateChallenge(clientId, difficulty);
      
      res.status(428).json({
        error: 'Proof of work required',
        challenge,
        difficulty: diff,
        expiresAt,
        instructions: 'Find nonce where SHA256(challenge + nonce) has required leading zero bits. ' +
          'Submit with X-PoW-Challenge and X-PoW-Nonce headers.',
      });
      return;
    }
    
    // Verify PoW
    const result = verifySolution(clientId, powChallenge, powNonce);
    
    if (!result.valid) {
      res.status(403).json({
        error: 'Invalid proof of work',
        message: result.error,
      });
      return;
    }
    
    // PoW verified - proceed
    next();
  };
}

/**
 * Endpoint to request a PoW challenge
 * 
 * Usage:
 * ```typescript
 * app.get('/api/pow/challenge', powChallengeHandler(POW_DIFFICULTY.LOW));
 * ```
 */
export function powChallengeHandler(difficulty: number = POW_DIFFICULTY.LOW) {
  return (req: Request, res: Response) => {
    const clientId = getClientId(req);
    const challenge = generateChallenge(clientId, difficulty);
    
    res.json({
      challenge: challenge.challenge,
      difficulty: challenge.difficulty,
      expiresAt: challenge.expiresAt,
      algorithm: 'sha256',
      instructions: 'Find nonce where SHA256(challenge + nonce) has required leading zero bits.',
    });
  };
}

/**
 * Client-side PoW solver (for reference/testing)
 * 
 * Note: In production, clients should implement this in their own code.
 */
export function solveChallenge(challenge: string, difficulty: number): string {
  let nonce = 0;
  
  while (true) {
    const nonceStr = nonce.toString(16).padStart(16, '0');
    const hash = crypto.createHash('sha256')
      .update(challenge + nonceStr)
      .digest();
    
    if (countLeadingZeroBits(hash) >= difficulty) {
      return nonceStr;
    }
    
    nonce++;
  }
}

export default { 
  requirePoW, 
  powChallengeHandler, 
  generateChallenge, 
  verifySolution, 
  solveChallenge,
  POW_DIFFICULTY,
};
