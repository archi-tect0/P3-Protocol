import express, { Request, Response, NextFunction } from 'express';
import { 
  showLauncher, 
  getPinnedApps as getFlowPinnedApps, 
  addPinnedApp as addFlowPinnedApp, 
  removePinnedApp as removeFlowPinnedApp,
  type PinnedApp 
} from '../flows/launcher';
import { loadRegistry, getExternalApps } from './services/registryAdapter';
import { getPinnedApps as getMemoryPinned, addPinned, removePinned } from './services/sessionMemory';

export const launcherRouter = express.Router();

function requireWalletAuth(req: Request, res: Response, next: NextFunction) {
  const atlasUser = (req as any).atlasUser;

  if (!atlasUser || !atlasUser.wallet) {
    res.status(401).json({
      ok: false,
      error: 'Launcher endpoints require wallet authentication. Provide a valid Bearer token.',
      'data-testid': 'launcher-auth-error',
    });
    return;
  }

  next();
}

launcherRouter.get('/help', (req: Request, res: Response) => {
  res.json({
    ok: true,
    help: `Atlas Launcher - Your app hub

Endpoints:
- GET  /api/atlas/launcher - Get launcher with pinned apps and status (requires auth)
- GET  /api/atlas/launcher/pinned - Get pinned apps (requires auth)
- POST /api/atlas/launcher/pin - Pin an app { appId, label?, icon? } (requires auth)
- DELETE /api/atlas/launcher/pin/:appId - Unpin an app (requires auth)
- GET  /api/atlas/launcher/apps - List all available apps (requires auth)
- GET  /api/atlas/launcher/status - Launcher status (requires auth)
- GET  /api/atlas/launcher/help - This help message (public)

Voice commands:
- "show me my launcher"
- "pin Slack"
- "unpin Spotify"
- "what apps are available"`,
    commands: [
      'GET /api/atlas/launcher - Launcher with pinned apps (auth required)',
      'GET /api/atlas/launcher/pinned - Pinned apps list (auth required)',
      'POST /api/atlas/launcher/pin - Pin app { appId } (auth required)',
      'DELETE /api/atlas/launcher/pin/:appId - Unpin app (auth required)',
      'GET /api/atlas/launcher/apps - All apps (auth required)',
      'GET /api/atlas/launcher/status - Status (auth required)',
      'GET /api/atlas/launcher/help - Help (public)',
    ],
    'data-testid': 'launcher-help-response',
  });
});

launcherRouter.use(requireWalletAuth);

launcherRouter.get('/', async (req: Request, res: Response) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    
    const launcherData = await showLauncher(wallet);
    const externalApps = getExternalApps();
    const registry = loadRegistry();
    
    const pinnedFromMemory = getMemoryPinned(wallet);
    
    res.json({
      ok: true,
      launcher: {
        ...launcherData.data,
        pinnedAppIds: pinnedFromMemory,
        externalApps: Object.entries(externalApps).map(([id, app]) => ({
          id,
          name: app.name,
          category: app.category,
          url: app.url,
          pinned: pinnedFromMemory.includes(id),
        })),
        registeredApps: Object.keys(registry.apps).length,
        availableEndpoints: Object.keys(registry.endpoints).length,
      },
      flowId: launcherData.flowId,
      correlationId: launcherData.correlationId,
      ts: Date.now(),
      'data-testid': 'launcher-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Launcher failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'launcher-error',
    });
  }
});

launcherRouter.get('/pinned', (req: Request, res: Response) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const pinnedFromMemory = getMemoryPinned(wallet);
    const pinnedApps = getFlowPinnedApps(wallet);
    
    const merged = [...new Set([...pinnedFromMemory, ...pinnedApps.map(p => p.id)])];
    
    res.json({
      ok: true,
      pinned: merged,
      pinnedApps: pinnedApps.filter(p => merged.includes(p.id)),
      count: merged.length,
      ts: Date.now(),
      'data-testid': 'launcher-pinned-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get pinned apps',
      'data-testid': 'launcher-pinned-error',
    });
  }
});

launcherRouter.post('/pin', (req: Request, res: Response) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const { appId, label, icon } = req.body;

    if (!appId) {
      return res.status(400).json({
        ok: false,
        error: 'appId is required',
        'data-testid': 'launcher-pin-error',
      });
    }

    addPinned(wallet, appId);
    
    addFlowPinnedApp(wallet, {
      id: appId,
      name: label || appId,
      icon: icon || '📱',
      gradient: 'from-gray-500 to-gray-600',
      category: 'custom',
    });

    const pinned = getMemoryPinned(wallet);

    res.json({
      ok: true,
      pinned,
      message: `Pinned ${appId} to launcher`,
      ts: Date.now(),
      'data-testid': 'launcher-pin-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to pin app',
      'data-testid': 'launcher-pin-error',
    });
  }
});

launcherRouter.delete('/pin/:appId', (req: Request, res: Response) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const { appId } = req.params;

    removePinned(wallet, appId);
    removeFlowPinnedApp(wallet, appId);

    const pinned = getMemoryPinned(wallet);

    res.json({
      ok: true,
      pinned,
      message: `Unpinned ${appId} from launcher`,
      ts: Date.now(),
      'data-testid': 'launcher-unpin-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to unpin app',
      'data-testid': 'launcher-unpin-error',
    });
  }
});

launcherRouter.get('/apps', (req: Request, res: Response) => {
  try {
    const registry = loadRegistry();
    const externalApps = getExternalApps();
    
    const apps = [
      ...Object.entries(registry.apps).map(([id, app]) => ({
        id,
        name: app.name,
        type: 'internal' as const,
        version: app.version,
        permissions: app.permissions,
      })),
      ...Object.entries(externalApps).map(([id, app]) => ({
        id,
        name: app.name,
        type: 'external' as const,
        category: app.category,
        url: app.url,
      })),
    ];

    res.json({
      ok: true,
      apps,
      count: apps.length,
      ts: Date.now(),
      'data-testid': 'launcher-apps-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get apps',
      'data-testid': 'launcher-apps-error',
    });
  }
});

launcherRouter.get('/status', (req: Request, res: Response) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const pinned = getMemoryPinned(wallet);
    const registry = loadRegistry();
    const externalApps = getExternalApps();
    
    res.json({
      ok: true,
      status: {
        pinnedCount: pinned.length,
        registeredApps: Object.keys(registry.apps).length,
        externalApps: Object.keys(externalApps).length,
        totalEndpoints: Object.keys(registry.endpoints).length,
        ready: true,
      },
      ts: Date.now(),
      'data-testid': 'launcher-status-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get launcher status',
      'data-testid': 'launcher-status-error',
    });
  }
});
