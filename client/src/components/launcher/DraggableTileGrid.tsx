import { useState, useCallback, useMemo, useRef, KeyboardEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Folder, Plus, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface TileItem {
  id: string;
  appId: string;
  title: string;
  icon: React.ReactNode;
  gradient: string;
  folderId?: string | null;
  orderIndex: number;
}

export interface FolderItem {
  id: string;
  name: string;
  colorTag: string;
  tiles: TileItem[];
  orderIndex: number;
}

export type ColorTag = 'default' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';

const colorTagStyles: Record<ColorTag, string> = {
  default: 'from-slate-600 to-slate-700',
  red: 'from-red-500 to-red-600',
  orange: 'from-orange-500 to-orange-600',
  yellow: 'from-yellow-500 to-yellow-600',
  green: 'from-green-500 to-green-600',
  blue: 'from-blue-500 to-blue-600',
  purple: 'from-purple-500 to-purple-600',
  pink: 'from-pink-500 to-pink-600',
};

interface SortableTileProps {
  tile: TileItem;
  onClick: (tile: TileItem) => void;
  onLongPress?: (tile: TileItem) => void;
  isInFolder?: boolean;
}

function SortableTile({ tile, onClick, onLongPress, isInFolder }: SortableTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id });

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setIsLongPressing(true);
      onLongPress?.(tile);
    }, 500);
  }, [tile, onLongPress]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isLongPressing) {
      onClick(tile);
    }
    setIsLongPressing(false);
  }, [tile, onClick, isLongPressing]);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(tile);
    }
  }, [tile, onClick]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer transition-all duration-150',
        'hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
        isDragging && 'z-50 shadow-2xl',
        isInFolder ? 'w-14' : 'w-20'
      )}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      data-testid={`tile-${tile.appId}`}
    >
      <div className={cn(
        'rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg',
        tile.gradient,
        isInFolder ? 'w-10 h-10' : 'w-14 h-14'
      )}>
        <div className={isInFolder ? 'w-5 h-5' : 'w-7 h-7'}>{tile.icon}</div>
      </div>
      <span className={cn(
        'text-white text-center truncate w-full',
        isInFolder ? 'text-[9px]' : 'text-xs'
      )}>
        {tile.title}
      </span>
    </div>
  );
}

interface SortableFolderProps {
  folder: FolderItem;
  onOpen: (folder: FolderItem) => void;
  onRename: (folderId: string, name: string) => void;
  onDelete: (folderId: string) => void;
  onColorChange: (folderId: string, color: ColorTag) => void;
}

function SortableFolder({ folder, onOpen, onRename, onDelete, onColorChange }: SortableFolderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id });

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleRename = useCallback(() => {
    if (editName.trim() && editName !== folder.name) {
      onRename(folder.id, editName.trim());
    }
    setIsEditing(false);
  }, [folder.id, folder.name, editName, onRename]);

  const previewTiles = folder.tiles.slice(0, 4);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer transition-all duration-150',
        'hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
        isDragging && 'z-50 shadow-2xl'
      )}
      tabIndex={0}
      onClick={() => !isEditing && onOpen(folder)}
      data-testid={`folder-${folder.id}`}
    >
      <div className={cn(
        'w-14 h-14 rounded-2xl bg-gradient-to-br flex flex-wrap items-center justify-center p-1 gap-0.5 shadow-lg relative',
        colorTagStyles[folder.colorTag as ColorTag] || colorTagStyles.default
      )}>
        {previewTiles.length > 0 ? (
          previewTiles.map((tile) => (
            <div
              key={tile.id}
              className="w-5 h-5 rounded bg-black/20 flex items-center justify-center"
            >
              <div className="w-3 h-3">{tile.icon}</div>
            </div>
          ))
        ) : (
          <Folder className="w-7 h-7 text-white/80" />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <button className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100">
              <MoreVertical className="w-3 h-3 text-white" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
            <DropdownMenuItem onClick={() => setIsEditing(true)} className="text-white">
              <Edit2 className="w-4 h-4 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 flex gap-1">
              {Object.keys(colorTagStyles).map((color) => (
                <button
                  key={color}
                  className={cn(
                    'w-5 h-5 rounded-full bg-gradient-to-br',
                    colorTagStyles[color as ColorTag],
                    folder.colorTag === color && 'ring-2 ring-white'
                  )}
                  onClick={() => onColorChange(folder.id, color as ColorTag)}
                />
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(folder.id)} className="text-red-400">
              <Trash2 className="w-4 h-4 mr-2" /> Delete Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isEditing ? (
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          className="w-full text-xs text-center bg-transparent text-white border-b border-purple-500 outline-none"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="text-xs text-white text-center truncate w-full">{folder.name}</span>
      )}
    </div>
  );
}

interface DraggableTileGridProps {
  tiles: TileItem[];
  folders: FolderItem[];
  onTileClick: (tile: TileItem) => void;
  onTileLongPress?: (tile: TileItem) => void;
  onReorder: (tiles: TileItem[], folders: FolderItem[]) => void;
  onCreateFolder: () => FolderItem;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onFolderColorChange: (folderId: string, color: ColorTag) => void;
  onTileDropOnTile?: (draggedTile: TileItem, targetTile: TileItem) => void;
  onFolderOpen: (folder: FolderItem) => void;
  className?: string;
}

export function DraggableTileGrid({
  tiles,
  folders,
  onTileClick,
  onTileLongPress,
  onReorder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onFolderColorChange,
  onTileDropOnTile,
  onFolderOpen,
  className,
}: DraggableTileGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [_overId, setOverId] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const rootTiles = useMemo(() => 
    tiles.filter(t => !t.folderId).sort((a, b) => a.orderIndex - b.orderIndex),
    [tiles]
  );

  const sortedFolders = useMemo(() => 
    [...folders].sort((a, b) => a.orderIndex - b.orderIndex),
    [folders]
  );

  const allItems = useMemo(() => {
    const combined: Array<TileItem | FolderItem> = [];
    let tileIndex = 0;
    let folderIndex = 0;
    
    while (tileIndex < rootTiles.length || folderIndex < sortedFolders.length) {
      const tile = rootTiles[tileIndex];
      const folder = sortedFolders[folderIndex];
      
      if (!folder || (tile && tile.orderIndex <= folder.orderIndex)) {
        combined.push(tile);
        tileIndex++;
      } else {
        combined.push(folder);
        folderIndex++;
      }
    }
    
    return combined;
  }, [rootTiles, sortedFolders]);

  const itemIds = useMemo(() => allItems.map(item => item.id), [allItems]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id) return;

    const activeItem = allItems.find(item => item.id === active.id);
    const overItem = allItems.find(item => item.id === over.id);

    if (!activeItem || !overItem) return;

    if ('appId' in activeItem && 'appId' in overItem && onTileDropOnTile) {
      onTileDropOnTile(activeItem, overItem);
      return;
    }

    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));

    if (oldIndex !== newIndex) {
      const reorderedItems = arrayMove(allItems, oldIndex, newIndex);
      
      const newTiles = reorderedItems
        .filter((item): item is TileItem => 'appId' in item)
        .map((tile, index) => ({ ...tile, orderIndex: index }));
      
      const newFolders = reorderedItems
        .filter((item): item is FolderItem => 'tiles' in item)
        .map((folder, index) => ({ ...folder, orderIndex: index }));

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => onReorder(newTiles, newFolders));
        } else {
          onReorder(newTiles, newFolders);
        }
      }, 150);
    }
  }, [allItems, itemIds, onReorder, onTileDropOnTile]);

  const activeItem = useMemo(() => 
    activeId ? allItems.find(item => item.id === activeId) : null,
    [activeId, allItems]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        <div 
          className={cn(
            'grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 p-2',
            className
          )}
          data-testid="draggable-tile-grid"
        >
          {allItems.map((item) => (
            'appId' in item ? (
              <SortableTile
                key={item.id}
                tile={item}
                onClick={onTileClick}
                onLongPress={onTileLongPress}
              />
            ) : (
              <SortableFolder
                key={item.id}
                folder={item}
                onOpen={onFolderOpen}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
                onColorChange={onFolderColorChange}
              />
            )
          ))}
          <button
            onClick={onCreateFolder}
            className="flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
            data-testid="button-create-folder"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/10 border-2 border-dashed border-white/20 flex items-center justify-center">
              <Plus className="w-6 h-6 text-white/50" />
            </div>
            <span className="text-xs text-white/50">New Folder</span>
          </button>
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem && (
          'appId' in activeItem ? (
            <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-black/80 shadow-2xl">
              <div className={cn('w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg', activeItem.gradient)}>
                <div className="w-7 h-7">{activeItem.icon}</div>
              </div>
              <span className="text-xs text-white text-center truncate w-full">{activeItem.title}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-black/80 shadow-2xl">
              <div className={cn('w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg', colorTagStyles[(activeItem as FolderItem).colorTag as ColorTag] || colorTagStyles.default)}>
                <Folder className="w-7 h-7 text-white/80" />
              </div>
              <span className="text-xs text-white text-center truncate w-full">{(activeItem as FolderItem).name}</span>
            </div>
          )
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default DraggableTileGrid;
