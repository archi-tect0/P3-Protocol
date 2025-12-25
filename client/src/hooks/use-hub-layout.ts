import { useState, useEffect, useCallback } from 'react';
import { 
  HubLayout, 
  TileRef, 
  Folder, 
  loadLayout, 
  saveLayout, 
  generateFolderId,
  isTileInFavorites,
  findFolderContainingTile,
  fetchLayoutFromServer,
  createFolderOnServer,
  updateFolderOnServer,
  deleteFolderOnServer
} from '@/lib/hubLayout';

interface UseHubLayoutReturn {
  layout: HubLayout;
  isLoaded: boolean;
  addFavorite: (tile: TileRef) => void;
  removeFavorite: (appId: string) => void;
  toggleFavorite: (tile: TileRef) => void;
  isFavorite: (appId: string) => boolean;
  createFolder: (name: string, colorTag?: string) => Folder;
  deleteFolder: (folderId: string) => void;
  renameFolder: (folderId: string, newName: string, colorTag?: string) => void;
  addToFolder: (folderId: string, tile: TileRef) => void;
  removeFromFolder: (folderId: string, appId: string) => void;
  getTileFolder: (appId: string) => Folder | null;
  reorderItems: (newFavorites: TileRef[], newFolders: Folder[]) => void;
}

export function useHubLayout(walletAddress: string | null): UseHubLayoutReturn {
  const [layout, setLayout] = useState<HubLayout>({ favorites: [], folders: [], widgets: [] });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const initLayout = async () => {
      if (walletAddress) {
        const localLayout = loadLayout(walletAddress);
        setLayout(localLayout);
        setIsLoaded(true);

        const serverLayout = await fetchLayoutFromServer(walletAddress);
        if (serverLayout) {
          const localClock = localLayout.vectorClock || 0;
          const serverClock = serverLayout.vectorClock || 0;
          
          if (serverClock > localClock) {
            const merged = mergeLayouts(localLayout, serverLayout);
            setLayout(merged);
            saveLayout(walletAddress, merged);
          }
        }
      } else {
        setLayout({ favorites: [], folders: [], widgets: [] });
        setIsLoaded(false);
      }
    };
    
    initLayout();
  }, [walletAddress]);

  const persistLayout = useCallback((newLayout: HubLayout) => {
    if (walletAddress) {
      saveLayout(walletAddress, newLayout);
    }
  }, [walletAddress]);

  const addFavorite = useCallback((tile: TileRef) => {
    setLayout(prev => {
      if (prev.favorites.some(f => f.appId === tile.appId)) {
        return prev;
      }
      const newTile = { ...tile, orderIndex: prev.favorites.length };
      const newLayout = {
        ...prev,
        favorites: [...prev.favorites, newTile],
      };
      persistLayout(newLayout);
      return newLayout;
    });
  }, [persistLayout]);

  const removeFavorite = useCallback((appId: string) => {
    setLayout(prev => {
      const newLayout = {
        ...prev,
        favorites: prev.favorites
          .filter(f => f.appId !== appId)
          .map((f, i) => ({ ...f, orderIndex: i })),
      };
      persistLayout(newLayout);
      return newLayout;
    });
  }, [persistLayout]);

  const toggleFavorite = useCallback((tile: TileRef) => {
    setLayout(prev => {
      const exists = prev.favorites.some(f => f.appId === tile.appId);
      const newFavorites = exists 
        ? prev.favorites.filter(f => f.appId !== tile.appId).map((f, i) => ({ ...f, orderIndex: i }))
        : [...prev.favorites, { ...tile, orderIndex: prev.favorites.length }];
      
      const newLayout = { ...prev, favorites: newFavorites };
      persistLayout(newLayout);
      return newLayout;
    });
  }, [persistLayout]);

  const isFavorite = useCallback((appId: string) => {
    return isTileInFavorites(layout, appId);
  }, [layout]);

  const createFolder = useCallback((name: string, colorTag?: string): Folder => {
    const newFolder: Folder = {
      id: generateFolderId(),
      name,
      tiles: [],
      colorTag: colorTag || 'default',
      orderIndex: layout.folders.length,
    };
    
    setLayout(prev => {
      const newLayout = {
        ...prev,
        folders: [...prev.folders, newFolder],
      };
      persistLayout(newLayout);
      return newLayout;
    });

    if (walletAddress) {
      createFolderOnServer(walletAddress, name, colorTag);
    }

    return newFolder;
  }, [persistLayout, layout.folders.length, walletAddress]);

  const deleteFolder = useCallback((folderId: string) => {
    setLayout(prev => {
      const newLayout = {
        ...prev,
        folders: prev.folders
          .filter(f => f.id !== folderId)
          .map((f, i) => ({ ...f, orderIndex: i })),
      };
      persistLayout(newLayout);
      return newLayout;
    });

    if (walletAddress) {
      deleteFolderOnServer(walletAddress, folderId);
    }
  }, [persistLayout, walletAddress]);

  const renameFolder = useCallback((folderId: string, newName: string, colorTag?: string) => {
    setLayout(prev => {
      const newLayout = {
        ...prev,
        folders: prev.folders.map(f => 
          f.id === folderId 
            ? { ...f, name: newName, colorTag: colorTag || f.colorTag } 
            : f
        ),
      };
      persistLayout(newLayout);
      return newLayout;
    });

    if (walletAddress) {
      updateFolderOnServer(walletAddress, folderId, newName, colorTag);
    }
  }, [persistLayout, walletAddress]);

  const addToFolder = useCallback((folderId: string, tile: TileRef) => {
    setLayout(prev => {
      const newLayout = {
        ...prev,
        folders: prev.folders.map(folder => {
          if (folder.id !== folderId) return folder;
          if (folder.tiles.some(t => t.appId === tile.appId)) return folder;
          return { 
            ...folder, 
            tiles: [...folder.tiles, { ...tile, orderIndex: folder.tiles.length }] 
          };
        }),
      };
      persistLayout(newLayout);
      return newLayout;
    });
  }, [persistLayout]);

  const removeFromFolder = useCallback((folderId: string, appId: string) => {
    setLayout(prev => {
      const newLayout = {
        ...prev,
        folders: prev.folders.map(folder => {
          if (folder.id !== folderId) return folder;
          return { 
            ...folder, 
            tiles: folder.tiles
              .filter(t => t.appId !== appId)
              .map((t, i) => ({ ...t, orderIndex: i }))
          };
        }),
      };
      persistLayout(newLayout);
      return newLayout;
    });
  }, [persistLayout]);

  const getTileFolder = useCallback((appId: string): Folder | null => {
    return findFolderContainingTile(layout, appId);
  }, [layout]);

  const reorderItems = useCallback((newFavorites: TileRef[], newFolders: Folder[]) => {
    setLayout(prev => {
      const newLayout = {
        ...prev,
        favorites: newFavorites.map((f, i) => ({ ...f, orderIndex: i })),
        folders: newFolders.map((f, i) => ({ ...f, orderIndex: i })),
      };
      persistLayout(newLayout);
      return newLayout;
    });
  }, [persistLayout]);

  return {
    layout,
    isLoaded,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    createFolder,
    deleteFolder,
    renameFolder,
    addToFolder,
    removeFromFolder,
    getTileFolder,
    reorderItems,
  };
}

function mergeLayouts(local: HubLayout, server: HubLayout): HubLayout {
  const mergedFavorites = new Map<string, TileRef>();
  
  for (const tile of server.favorites) {
    mergedFavorites.set(tile.appId, tile);
  }
  for (const tile of local.favorites) {
    if (!mergedFavorites.has(tile.appId)) {
      mergedFavorites.set(tile.appId, tile);
    }
  }

  const mergedFolders = new Map<string, Folder>();
  
  for (const folder of server.folders) {
    mergedFolders.set(folder.id, folder);
  }
  for (const folder of local.folders) {
    if (!mergedFolders.has(folder.id)) {
      mergedFolders.set(folder.id, folder);
    }
  }

  return {
    favorites: Array.from(mergedFavorites.values()).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    folders: Array.from(mergedFolders.values()).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    widgets: [...local.widgets, ...server.widgets.filter(sw => !local.widgets.some(lw => lw.widgetId === sw.widgetId))],
    vectorClock: Math.max(local.vectorClock || 0, server.vectorClock || 0),
  };
}
