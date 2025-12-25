/**
 * Marketplace Manifest Registry
 * Handles app discovery for the P3 Launcher
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { marketplaceManifests } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export const manifestRouter = Router();

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.p3protocol.io';

// Default manifests for built-in marketplaces
const defaultManifests = [
  {
    id: 'ebook-market',
    type: 'marketplace',
    category: 'ebooks',
    title: 'P3 Ebook Store',
    description: 'Encrypted, anchored ebook marketplace with lending and purchase options',
    icon: '/icons/ebook-store.svg',
    version: '1.0.0',
    routes: {
      home: '/marketplace/ebooks',
      detail: '/marketplace/ebooks/:id',
      checkout: '/marketplace/ebooks/checkout',
      reader: '/marketplace/ebooks/read/:id',
    },
    api: {
      baseUrl: API_BASE_URL,
      ping: '/api/marketplace/health',
      assets: '/api/marketplace/catalog',
      checkout: '/api/marketplace/gate/checkout',
      content: '/api/marketplace/content/download',
      explorer: '/api/marketplace/explorer/feed',
    },
    requirements: {
      wallet: true,
      ticketGate: true,
      anchorReceipts: true,
    },
    capabilities: {
      sponsorship: true,
      subscriptions: true,
      batchAnchors: false,
      lending: true,
    },
  },
  {
    id: 'music-market',
    type: 'marketplace',
    category: 'music',
    title: 'P3 Music Hub',
    description: 'Anchored streaming and downloads with batch play receipts',
    icon: '/icons/music-hub.svg',
    version: '1.0.0',
    routes: {
      home: '/marketplace/music',
      detail: '/marketplace/music/:id',
      checkout: '/marketplace/music/checkout',
      player: '/marketplace/music/play/:id',
    },
    api: {
      baseUrl: API_BASE_URL,
      ping: '/api/marketplace/health',
      assets: '/api/marketplace/catalog',
      checkout: '/api/marketplace/gate/stream',
      content: '/api/marketplace/content/stream',
      explorer: '/api/marketplace/explorer/feed',
    },
    requirements: {
      wallet: true,
      ticketGate: true,
      anchorReceipts: true,
    },
    capabilities: {
      sponsorship: true,
      subscriptions: true,
      batchAnchors: true,
      streaming: true,
    },
  },
  {
    id: 'video-market',
    type: 'marketplace',
    category: 'video',
    title: 'P3 Video Vault',
    description: 'Encrypted video rentals and purchases with proof of viewing',
    icon: '/icons/video-vault.svg',
    version: '1.0.0',
    routes: {
      home: '/marketplace/video',
      detail: '/marketplace/video/:id',
      player: '/marketplace/video/watch/:id',
    },
    api: {
      baseUrl: API_BASE_URL,
      ping: '/api/marketplace/health',
      assets: '/api/marketplace/catalog',
      checkout: '/api/marketplace/gate/stream',
      content: '/api/marketplace/content/stream',
      explorer: '/api/marketplace/explorer/feed',
    },
    requirements: {
      wallet: true,
      ticketGate: true,
      anchorReceipts: true,
    },
    capabilities: {
      sponsorship: true,
      subscriptions: true,
      batchAnchors: true,
      rental: true,
    },
  },
  {
    id: 'course-market',
    type: 'marketplace',
    category: 'courses',
    title: 'P3 Academy',
    description: 'Encrypted courseware with enrollment and completion certificates',
    icon: '/icons/academy.svg',
    version: '1.0.0',
    routes: {
      home: '/marketplace/courses',
      detail: '/marketplace/courses/:id',
      learn: '/marketplace/courses/learn/:id',
    },
    api: {
      baseUrl: API_BASE_URL,
      ping: '/api/marketplace/health',
      assets: '/api/marketplace/catalog',
      checkout: '/api/marketplace/gate/checkout',
      content: '/api/marketplace/content/download',
      explorer: '/api/marketplace/explorer/feed',
    },
    requirements: {
      wallet: true,
      ticketGate: true,
      anchorReceipts: true,
    },
    capabilities: {
      sponsorship: true,
      subscriptions: true,
      certificates: true,
    },
  },
  {
    id: 'game-market',
    type: 'marketplace',
    category: 'games',
    title: 'P3 Game Vault',
    description: 'Encrypted game downloads with DLC and achievement anchoring',
    icon: '/icons/game-vault.svg',
    version: '1.0.0',
    routes: {
      home: '/marketplace/games',
      detail: '/marketplace/games/:id',
      play: '/marketplace/games/play/:id',
    },
    api: {
      baseUrl: API_BASE_URL,
      ping: '/api/marketplace/health',
      assets: '/api/marketplace/catalog',
      checkout: '/api/marketplace/gate/checkout',
      content: '/api/marketplace/content/download',
      explorer: '/api/marketplace/explorer/feed',
    },
    requirements: {
      wallet: true,
      ticketGate: true,
      anchorReceipts: true,
    },
    capabilities: {
      sponsorship: false,
      dlc: true,
      achievements: true,
    },
  },
  {
    id: 'data-market',
    type: 'marketplace',
    category: 'data',
    title: 'P3 Data Exchange',
    description: 'Encrypted datasets with API access and usage metering',
    icon: '/icons/data-exchange.svg',
    version: '1.0.0',
    routes: {
      home: '/marketplace/data',
      detail: '/marketplace/data/:id',
      access: '/marketplace/data/access/:id',
    },
    api: {
      baseUrl: API_BASE_URL,
      ping: '/api/marketplace/health',
      assets: '/api/marketplace/catalog',
      checkout: '/api/marketplace/gate/checkout',
      content: '/api/marketplace/content/download',
      explorer: '/api/marketplace/explorer/feed',
    },
    requirements: {
      wallet: true,
      ticketGate: true,
      anchorReceipts: true,
    },
    capabilities: {
      apiAccess: true,
      metering: true,
    },
  },
  {
    id: 'art-market',
    type: 'marketplace',
    category: 'art',
    title: 'P3 Gallery',
    description: 'Digital art marketplace with editions and provenance anchoring',
    icon: '/icons/gallery.svg',
    version: '1.0.0',
    routes: {
      home: '/marketplace/art',
      detail: '/marketplace/art/:id',
      view: '/marketplace/art/view/:id',
    },
    api: {
      baseUrl: API_BASE_URL,
      ping: '/api/marketplace/health',
      assets: '/api/marketplace/catalog',
      checkout: '/api/marketplace/gate/checkout',
      content: '/api/marketplace/content/download',
      explorer: '/api/marketplace/explorer/feed',
    },
    requirements: {
      wallet: true,
      ticketGate: true,
      anchorReceipts: true,
    },
    capabilities: {
      editions: true,
      provenance: true,
    },
  },
];

// Get all manifests (built-in + registered)
manifestRouter.get('/', async (req, res) => {
  try {
    const { category, type } = req.query;
    
    // Get registered manifests from DB
    const registered = await db
      .select()
      .from(marketplaceManifests)
      .where(eq(marketplaceManifests.isListed, true))
      .orderBy(desc(marketplaceManifests.createdAt));
    
    // Merge with defaults (DB overrides defaults)
    const registeredIds = new Set(registered.map(m => m.id));
    const defaults = defaultManifests.filter(m => !registeredIds.has(m.id));
    
    let items = [...defaults, ...registered.map(r => ({
      ...r,
      routes: r.routes as Record<string, string>,
      api: r.api as Record<string, string>,
      requirements: r.requirements as Record<string, boolean>,
      capabilities: r.capabilities as Record<string, boolean>,
    }))];
    
    // Filter by category if specified
    if (category && typeof category === 'string') {
      items = items.filter(m => m.category === category);
    }
    
    // Filter by type if specified
    if (type && typeof type === 'string') {
      items = items.filter(m => m.type === type);
    }
    
    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch manifests' });
  }
});

// Get single manifest by ID
manifestRouter.get('/:id', async (req, res) => {
  try {
    // Check DB first
    const [registered] = await db
      .select()
      .from(marketplaceManifests)
      .where(eq(marketplaceManifests.id, req.params.id))
      .limit(1);
    
    if (registered) {
      return res.json({
        ...registered,
        routes: registered.routes as Record<string, string>,
        api: registered.api as Record<string, string>,
        requirements: registered.requirements as Record<string, boolean>,
        capabilities: registered.capabilities as Record<string, boolean>,
      });
    }
    
    // Fall back to defaults
    const defaultManifest = defaultManifests.find(m => m.id === req.params.id);
    if (defaultManifest) {
      return res.json(defaultManifest);
    }
    
    res.status(404).json({ error: 'Manifest not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch manifest' });
  }
});

// Register new manifest (author endpoint)
const ManifestSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['marketplace', 'app', 'game', 'tool']).default('marketplace'),
  category: z.string().min(1).max(50),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  icon: z.string().optional(),
  version: z.string().min(1).max(20),
  routes: z.record(z.string()),
  api: z.object({
    baseUrl: z.string(),
    ping: z.string(),
    assets: z.string().optional(),
    checkout: z.string().optional(),
    content: z.string().optional(),
    explorer: z.string().optional(),
  }),
  requirements: z.object({
    wallet: z.boolean().optional(),
    ticketGate: z.boolean().optional(),
    anchorReceipts: z.boolean().optional(),
  }).optional(),
  capabilities: z.record(z.boolean()).optional(),
});

manifestRouter.post('/', async (req, res) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet || typeof wallet !== 'string') {
      return res.status(401).json({ error: 'Wallet required' });
    }
    
    const manifest = ManifestSchema.parse(req.body);
    
    const [created] = await db.insert(marketplaceManifests).values({
      id: manifest.id,
      type: manifest.type,
      category: manifest.category,
      title: manifest.title,
      description: manifest.description,
      icon: manifest.icon,
      version: manifest.version,
      routes: manifest.routes,
      api: manifest.api,
      requirements: manifest.requirements,
      capabilities: manifest.capabilities,
      authorWallet: wallet.toLowerCase(),
      isListed: true,
    }).onConflictDoUpdate({
      target: marketplaceManifests.id,
      set: {
        type: manifest.type,
        category: manifest.category,
        title: manifest.title,
        description: manifest.description,
        icon: manifest.icon,
        version: manifest.version,
        routes: manifest.routes,
        api: manifest.api,
        requirements: manifest.requirements,
        capabilities: manifest.capabilities,
        updatedAt: new Date(),
      },
    }).returning();
    
    res.json({ manifest: created });
  } catch (error) {
    res.status(400).json({ error: 'Failed to register manifest' });
  }
});

// Unregister manifest
manifestRouter.delete('/:id', async (req, res) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet || typeof wallet !== 'string') {
      return res.status(401).json({ error: 'Wallet required' });
    }
    
    const [manifest] = await db
      .select()
      .from(marketplaceManifests)
      .where(eq(marketplaceManifests.id, req.params.id))
      .limit(1);
    
    if (!manifest) {
      return res.status(404).json({ error: 'Manifest not found' });
    }
    
    if (manifest.authorWallet !== wallet.toLowerCase()) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await db
      .update(marketplaceManifests)
      .set({ isListed: false, updatedAt: new Date() })
      .where(eq(marketplaceManifests.id, req.params.id));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unregister manifest' });
  }
});

// Ping check (for launcher discovery)
manifestRouter.get('/:id/ping', async (req, res) => {
  try {
    // For built-in manifests, always return OK
    const defaultManifest = defaultManifests.find(m => m.id === req.params.id);
    if (defaultManifest) {
      return res.json({ ok: true, version: defaultManifest.version });
    }
    
    // For registered manifests, could ping external API
    const [manifest] = await db
      .select()
      .from(marketplaceManifests)
      .where(eq(marketplaceManifests.id, req.params.id))
      .limit(1);
    
    if (!manifest) {
      return res.status(404).json({ ok: false, error: 'Not found' });
    }
    
    // Update ping status
    await db
      .update(marketplaceManifests)
      .set({ pingStatus: 'ok', lastPingAt: new Date() })
      .where(eq(marketplaceManifests.id, req.params.id));
    
    res.json({ ok: true, version: manifest.version });
  } catch (error) {
    res.json({ ok: false, error: 'Ping failed' });
  }
});

// Categories list
manifestRouter.get('/meta/categories', async (_req, res) => {
  const categories = [
    { id: 'ebooks', name: 'Ebooks', icon: 'book' },
    { id: 'music', name: 'Music', icon: 'music' },
    { id: 'video', name: 'Video', icon: 'video' },
    { id: 'courses', name: 'Courses', icon: 'graduation-cap' },
    { id: 'games', name: 'Games', icon: 'gamepad' },
    { id: 'data', name: 'Data', icon: 'database' },
    { id: 'art', name: 'Art', icon: 'palette' },
  ];
  res.json({ categories });
});
