export interface TileRef {
  appId: string;
  title: string;
  category: 'communication' | 'security' | 'payments' | 'creative' | 'social' | 'governance' | 'analytics' | 'developer' | 'games' | 'external';
  icon?: string;
  orderIndex?: number;
  colorTag?: string;
}

export interface Folder {
  id: string;
  name: string;
  tiles: TileRef[];
  colorTag?: string;
  orderIndex?: number;
}

export interface WidgetRef {
  widgetId: string;
}

export interface HubLayout {
  favorites: TileRef[];
  folders: Folder[];
  widgets: WidgetRef[];
  vectorClock?: number;
}

const DEFAULT_LAYOUT: HubLayout = {
  favorites: [],
  folders: [],
  widgets: [],
};

export function walletScopedKey(addr: string): string {
  return `p3:hub:layout:${addr.toLowerCase()}`;
}

export function loadLayout(addr: string): HubLayout {
  if (!addr || typeof window === 'undefined') {
    return { ...DEFAULT_LAYOUT };
  }
  
  try {
    const key = walletScopedKey(addr);
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as HubLayout;
      return {
        favorites: parsed.favorites || [],
        folders: parsed.folders || [],
        widgets: parsed.widgets || [],
        vectorClock: parsed.vectorClock,
      };
    }
  } catch (e) {
    console.error('[HubLayout] Failed to load layout:', e);
  }
  
  return { ...DEFAULT_LAYOUT };
}

export function saveLayout(addr: string, layout: HubLayout): boolean {
  if (!addr || typeof window === 'undefined') {
    return false;
  }
  
  try {
    const key = walletScopedKey(addr);
    const toSave = { ...layout, vectorClock: Date.now() };
    localStorage.setItem(key, JSON.stringify(toSave));
    
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => syncLayoutToServer(addr, toSave));
    } else {
      setTimeout(() => syncLayoutToServer(addr, toSave), 100);
    }
    
    return true;
  } catch (e) {
    console.error('[HubLayout] Failed to save layout:', e);
    return false;
  }
}

let syncDebounceTimer: NodeJS.Timeout | null = null;

async function syncLayoutToServer(addr: string, layout: HubLayout): Promise<void> {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  
  syncDebounceTimer = setTimeout(async () => {
    try {
      const tiles: Array<{ tileId: string; folderId: string | null; orderIndex: number; colorTag: string }> = layout.favorites.map((tile, index) => ({
        tileId: tile.appId,
        folderId: null,
        orderIndex: tile.orderIndex ?? index,
        colorTag: tile.colorTag || 'default',
      }));

      for (const folder of layout.folders) {
        for (let i = 0; i < folder.tiles.length; i++) {
          const tile = folder.tiles[i];
          tiles.push({
            tileId: tile.appId,
            folderId: folder.id,
            orderIndex: tile.orderIndex ?? i,
            colorTag: tile.colorTag || 'default',
          });
        }
      }

      const response = await fetch('/api/launcher/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: addr,
          tiles,
          vectorClock: layout.vectorClock,
        }),
      });

      if (!response.ok) {
        console.warn('[HubLayout] Server sync failed:', await response.text());
      }
    } catch (e) {
      console.error('[HubLayout] Failed to sync to server:', e);
    }
  }, 500);
}

export async function fetchLayoutFromServer(addr: string): Promise<HubLayout | null> {
  try {
    const response = await fetch(`/api/launcher/layout?address=${encodeURIComponent(addr)}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.ok) return null;

    const { tiles, folders } = data.layout;
    const localLayout = loadLayout(addr);
    
    if (localLayout.vectorClock && localLayout.vectorClock > data.vectorClock) {
      return localLayout;
    }

    const folderMap = new Map<string, Folder>();
    for (const folder of folders) {
      folderMap.set(folder.id, {
        id: folder.id,
        name: folder.name,
        tiles: [],
        colorTag: folder.colorTag,
        orderIndex: folder.orderIndex,
      });
    }

    const favorites: TileRef[] = [];
    for (const tile of tiles) {
      const tileRef: TileRef = {
        appId: tile.tileId,
        title: tile.tileId,
        category: 'external',
        orderIndex: tile.orderIndex,
        colorTag: tile.colorTag,
      };

      if (tile.folderId && folderMap.has(tile.folderId)) {
        folderMap.get(tile.folderId)!.tiles.push(tileRef);
      } else {
        favorites.push(tileRef);
      }
    }

    return {
      favorites: favorites.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
      folders: Array.from(folderMap.values()).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
      widgets: [],
      vectorClock: data.vectorClock,
    };
  } catch (e) {
    console.error('[HubLayout] Failed to fetch from server:', e);
    return null;
  }
}

export async function createFolderOnServer(addr: string, name: string, colorTag?: string): Promise<Folder | null> {
  try {
    const response = await fetch('/api/launcher/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: addr,
        operation: 'create',
        folder: { name, colorTag },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data.ok) return null;

    return {
      id: data.folder.id,
      name: data.folder.name,
      tiles: [],
      colorTag: data.folder.colorTag,
      orderIndex: data.folder.orderIndex,
    };
  } catch (e) {
    console.error('[HubLayout] Failed to create folder on server:', e);
    return null;
  }
}

export async function updateFolderOnServer(addr: string, folderId: string, name: string, colorTag?: string): Promise<boolean> {
  try {
    const response = await fetch('/api/launcher/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: addr,
        operation: 'rename',
        folder: { id: folderId, name, colorTag },
      }),
    });

    return response.ok && (await response.json()).ok;
  } catch (e) {
    console.error('[HubLayout] Failed to update folder on server:', e);
    return false;
  }
}

export async function deleteFolderOnServer(addr: string, folderId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/launcher/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: addr,
        operation: 'delete',
        folder: { id: folderId, name: '' },
      }),
    });

    return response.ok && (await response.json()).ok;
  } catch (e) {
    console.error('[HubLayout] Failed to delete folder on server:', e);
    return false;
  }
}

export function generateFolderId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isTileInFavorites(layout: HubLayout, appId: string): boolean {
  return layout.favorites.some(tile => tile.appId === appId);
}

export function findFolderContainingTile(layout: HubLayout, appId: string): Folder | null {
  for (const folder of layout.folders) {
    if (folder.tiles.some(tile => tile.appId === appId)) {
      return folder;
    }
  }
  return null;
}
