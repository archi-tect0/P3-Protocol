import { Router } from 'express';
import crypto from 'crypto';
import { createError } from '../middleware/errors';
import { enqueueAnchors } from '../../anchor/queue';
import { getRedis } from '../../redis/client';

const router = Router();

const ROOM_TTL_SECONDS = 3600;
const ROOM_KEY_PREFIX = 'media:room:';

const TURN_URL = process.env.TURN_URL || 'turn:turn.example.com:3478';
const TURN_USERNAME = process.env.TURN_USERNAME || 'p3-user';
const TURN_CREDENTIAL = process.env.TURN_CREDENTIAL || 'p3-credential';

interface RoomState {
  participants: string[];
  createdAt: number;
  recording?: boolean;
}

function generateRoomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateSessionId(): string {
  return crypto.randomUUID();
}

function generateSdpOffer(options: { video: boolean; audio: boolean }): string {
  const sessionId = Date.now();
  const sessionVersion = 1;
  const origin = `p3-media-${crypto.randomBytes(4).toString('hex')}`;
  
  let sdp = `v=0\r\n`;
  sdp += `o=${origin} ${sessionId} ${sessionVersion} IN IP4 0.0.0.0\r\n`;
  sdp += `s=P3 WebRTC Session\r\n`;
  sdp += `t=0 0\r\n`;
  sdp += `a=group:BUNDLE 0 1\r\n`;
  sdp += `a=msid-semantic: WMS\r\n`;
  
  if (options.audio) {
    sdp += `m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126\r\n`;
    sdp += `c=IN IP4 0.0.0.0\r\n`;
    sdp += `a=rtcp:9 IN IP4 0.0.0.0\r\n`;
    sdp += `a=ice-ufrag:${crypto.randomBytes(4).toString('hex')}\r\n`;
    sdp += `a=ice-pwd:${crypto.randomBytes(12).toString('hex')}\r\n`;
    sdp += `a=ice-options:trickle\r\n`;
    sdp += `a=fingerprint:sha-256 ${generateFingerprint()}\r\n`;
    sdp += `a=setup:actpass\r\n`;
    sdp += `a=mid:0\r\n`;
    sdp += `a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\n`;
    sdp += `a=sendrecv\r\n`;
    sdp += `a=rtcp-mux\r\n`;
    sdp += `a=rtpmap:111 opus/48000/2\r\n`;
    sdp += `a=rtcp-fb:111 transport-cc\r\n`;
    sdp += `a=fmtp:111 minptime=10;useinbandfec=1\r\n`;
  }
  
  if (options.video) {
    sdp += `m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 102\r\n`;
    sdp += `c=IN IP4 0.0.0.0\r\n`;
    sdp += `a=rtcp:9 IN IP4 0.0.0.0\r\n`;
    sdp += `a=ice-ufrag:${crypto.randomBytes(4).toString('hex')}\r\n`;
    sdp += `a=ice-pwd:${crypto.randomBytes(12).toString('hex')}\r\n`;
    sdp += `a=ice-options:trickle\r\n`;
    sdp += `a=fingerprint:sha-256 ${generateFingerprint()}\r\n`;
    sdp += `a=setup:actpass\r\n`;
    sdp += `a=mid:1\r\n`;
    sdp += `a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r\n`;
    sdp += `a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\n`;
    sdp += `a=extmap:4 urn:3gpp:video-orientation\r\n`;
    sdp += `a=sendrecv\r\n`;
    sdp += `a=rtcp-mux\r\n`;
    sdp += `a=rtcp-rsize\r\n`;
    sdp += `a=rtpmap:96 VP8/90000\r\n`;
    sdp += `a=rtcp-fb:96 goog-remb\r\n`;
    sdp += `a=rtcp-fb:96 transport-cc\r\n`;
    sdp += `a=rtcp-fb:96 ccm fir\r\n`;
    sdp += `a=rtcp-fb:96 nack\r\n`;
    sdp += `a=rtcp-fb:96 nack pli\r\n`;
    sdp += `a=rtpmap:97 rtx/90000\r\n`;
    sdp += `a=fmtp:97 apt=96\r\n`;
  }
  
  return sdp;
}

function generateFingerprint(): string {
  const bytes = crypto.randomBytes(32);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

function roomKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId}`;
}

async function getRoom(roomId: string): Promise<RoomState | null> {
  const redis = getRedis();
  const data = await redis.get(roomKey(roomId));
  if (!data) return null;
  try {
    return JSON.parse(data) as RoomState;
  } catch {
    return null;
  }
}

async function setRoom(roomId: string, room: RoomState): Promise<void> {
  const redis = getRedis();
  await redis.set(roomKey(roomId), JSON.stringify(room), 'EX', ROOM_TTL_SECONDS);
}

async function deleteRoom(roomId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(roomKey(roomId));
}

function hashWallet(wallet: string): string {
  return crypto.createHash('sha256').update(wallet).digest('hex').slice(0, 16);
}

router.post('/call/start', async (req, res, next) => {
  try {
    const { roomId, anchor = false, video = true, audio = true } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (!roomId) {
      throw createError('roomId required', 400, 'invalid_request');
    }

    let room = await getRoom(roomId);
    const isNewRoom = !room;
    
    if (!room) {
      room = {
        participants: [],
        createdAt: Date.now(),
      };
    }

    const hashedWallet = hashWallet(wallet);
    if (!room.participants.includes(hashedWallet)) {
      room.participants.push(hashedWallet);
    }

    await setRoom(roomId, room);

    const sdpOffer = generateSdpOffer({ video: !!video, audio: !!audio });
    const roomToken = generateRoomToken();
    const sessionId = generateSessionId();

    await enqueueAnchors([{
      appId: 'nexus',
      event: 'call_session_start',
      data: {
        roomId,
        sessionId,
        walletHash: hashedWallet,
        mediaType: video ? 'video' : 'audio',
        participantCount: room.participants.length,
        isNewRoom,
      },
      ts: Date.now(),
      idempotencyKey: `call_start:${roomId}:${hashedWallet}:${Date.now()}`,
    }]);

    if (anchor) {
      await enqueueAnchors([{
        appId: 'nexus',
        event: 'call_start',
        data: { roomId, wallet: hashedWallet, video },
        ts: Date.now(),
      }]);
    }

    res.json({
      ok: true,
      sdpOffer,
      turn: {
        urls: [TURN_URL, `${TURN_URL}?transport=tcp`],
        username: TURN_USERNAME,
        credential: TURN_CREDENTIAL,
      },
      roomToken,
      sessionId,
      participantCount: room.participants.length,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/call/end', async (req, res, next) => {
  try {
    const { roomId, anchor = false, sessionId } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (!roomId) {
      throw createError('roomId required', 400, 'invalid_request');
    }

    const hashedWallet = hashWallet(wallet);
    const room = await getRoom(roomId);
    let roomDeleted = false;
    
    if (room) {
      room.participants = room.participants.filter(p => p !== hashedWallet);
      
      if (room.participants.length === 0) {
        await deleteRoom(roomId);
        roomDeleted = true;
      } else {
        await setRoom(roomId, room);
      }
    }

    await enqueueAnchors([{
      appId: 'nexus',
      event: 'call_session_end',
      data: {
        roomId,
        sessionId: sessionId || 'unknown',
        walletHash: hashedWallet,
        roomDeleted,
        remainingParticipants: room?.participants.length || 0,
      },
      ts: Date.now(),
      idempotencyKey: `call_end:${roomId}:${hashedWallet}:${Date.now()}`,
    }]);

    if (anchor) {
      await enqueueAnchors([{
        appId: 'nexus',
        event: 'call_end',
        data: { roomId, wallet: hashedWallet },
        ts: Date.now(),
      }]);
    }

    res.json({ ok: true, roomDeleted });
  } catch (err) {
    next(err);
  }
});

router.post('/upload/presign', async (req, res, next) => {
  try {
    const { filename, contentType, anchor = false, maxSize } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (!filename || !contentType) {
      throw createError('filename and contentType required', 400, 'invalid_request');
    }

    const key = `uploads/${hashWallet(wallet)}/${Date.now()}-${filename}`;
    const url = `/api/uploads/${key}`;
    const expiresAt = Date.now() + 15 * 60 * 1000;

    if (anchor) {
      await enqueueAnchors([{
        appId: 'ready',
        event: 'upload_presign',
        data: { filename, key, wallet: hashWallet(wallet) },
        ts: Date.now(),
      }]);
    }

    res.json({ url, key, expiresAt });
  } catch (err) {
    next(err);
  }
});

router.get('/turn', async (req, res, next) => {
  try {
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    const ttl = 3600;
    const timestamp = Math.floor(Date.now() / 1000) + ttl;
    const hashedWallet = hashWallet(wallet);
    const username = `${timestamp}:${hashedWallet}`;
    
    const hmac = crypto.createHmac('sha1', TURN_CREDENTIAL);
    hmac.update(username);
    const credential = hmac.digest('base64');

    res.json({
      urls: [TURN_URL, `${TURN_URL}?transport=tcp`],
      username,
      credential,
      ttl,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/recording/:roomId', async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    const room = await getRoom(roomId);
    
    res.json({
      status: room?.recording ? 'recording' : 'pending' as const,
      url: undefined,
      participantCount: room?.participants.length || 0,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/room/:roomId', async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    const room = await getRoom(roomId);
    
    if (!room) {
      res.json({ exists: false });
      return;
    }

    res.json({
      exists: true,
      participantCount: room.participants.length,
      createdAt: room.createdAt,
      recording: room.recording || false,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
