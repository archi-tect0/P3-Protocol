/**
 * Marketplace Content Service
 * Handles encrypted content delivery, uploads, and streaming
 */

import { Router } from 'express';
import { db } from '../db';
import { marketplaceAssets, marketplaceLicenses } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { verifyToken } from './gate';
import crypto from 'crypto';

export const contentRouter = Router();

const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://gateway.pinata.cloud/ipfs';
const SIGNING_SECRET = process.env.CDN_SIGNING_SECRET || 'p3-content-signing';

// Generate signed URL for CDN/IPFS access
function signUrl(cid: string, options: { ttl: number } = { ttl: 300 }): string {
  const expires = Math.floor(Date.now() / 1000) + options.ttl;
  const signature = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(`${cid}:${expires}`)
    .digest('hex')
    .slice(0, 16);
  
  return `${CDN_BASE_URL}/${cid}?expires=${expires}&sig=${signature}`;
}

// Download encrypted content
contentRouter.get('/download', async (req, res) => {
  try {
    const licenseId = req.query.licenseId as string;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Decrypt token required' });
    }
    
    const claims = verifyToken(token);
    if (!claims || claims.licenseId !== licenseId) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    const [license] = await db
      .select()
      .from(marketplaceLicenses)
      .where(eq(marketplaceLicenses.id, licenseId))
      .limit(1);
    
    if (!license || license.status !== 'active') {
      return res.status(403).json({ error: 'License not active' });
    }
    
    // Check expiry
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      return res.status(403).json({ error: 'License expired' });
    }
    
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, license.assetId))
      .limit(1);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    const signedUrl = asset.ipfsCidEnc ? signUrl(asset.ipfsCidEnc) : null;
    
    res.json({
      signedUrl,
      ipfsCidEnc: asset.ipfsCidEnc,
      envelopeMeta: {
        alg: asset.encryptionAlg,
        version: asset.envelopeVersion,
      },
      mime: asset.mime,
      filesize: asset.filesize,
    });
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});

// Stream manifest (for HLS/DASH)
contentRouter.get('/stream/manifest', async (req, res) => {
  try {
    const { assetId, licenseId } = req.query as Record<string, string>;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    const claims = verifyToken(token);
    if (!claims || claims.assetId !== assetId) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, assetId))
      .limit(1);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // In production, return actual HLS manifest URL
    const manifestUrl = signUrl(`${asset.ipfsCidEnc}/manifest.m3u8`, { ttl: 3600 });
    
    res.json({
      hlsManifestUrl: manifestUrl,
      dashManifestUrl: null,
      duration: null, // Would be populated from metadata
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get manifest' });
  }
});

// Stream segment (for HLS/DASH)
contentRouter.get('/stream/segment', async (req, res) => {
  try {
    const { assetId, licenseId, segmentId } = req.query as Record<string, string>;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    const claims = verifyToken(token);
    if (!claims || claims.assetId !== assetId) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    // Short TTL for segments (60 seconds)
    const signedUrl = signUrl(`${assetId}/segments/${segmentId}`, { ttl: 60 });
    
    res.json({ signedUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get segment' });
  }
});

// Upload asset (author endpoint)
contentRouter.post('/upload', async (req, res) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet required' });
    }
    
    // In production, handle multipart upload here
    // For now, accept metadata and return placeholder
    const { envelope, filename, mime, size } = req.body;
    
    // Would pin to IPFS here
    const cid = `Qm${crypto.randomBytes(22).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
    
    res.json({
      cid,
      hash,
      size,
      envelope: {
        alg: envelope?.alg || 'xchacha20-poly1305',
        version: envelope?.version || '1.0',
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});
