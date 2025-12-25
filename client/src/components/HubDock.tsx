import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, ChevronUp, ChevronDown, Settings, Paintbrush, Eye } from 'lucide-react';
import { appRegistry, type AppDefinition } from '@/pages/launcher/appRegistry';
import { DockApp, DockStyle, DOCK_TINT_COLORS } from '@/lib/hubPreferences';
import { cn } from '@/lib/utils';

interface HubDockProps {
  dockApps: DockApp[];
  dockStyle?: DockStyle;
  onAppClick: (app: AppDefinition) => void;
  onAddApp?: (position: number) => void;
  onRemoveApp?: (appId: string) => void;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  showDock: boolean;
  onToggleDock?: () => void;
  onStyleChange?: (style: Partial<DockStyle>) => void;
}

function BottomSheet({ 
  open, 
  onClose, 
  children 
}: { 
  open: boolean; 
  onClose: () => void; 
  children: React.ReactNode 
}) {
  if (!open) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-300">
        {children}
      </div>
    </div>,
    document.body
  );
}

export function HubDock({
  dockApps,
  dockStyle = { opacity: 0.9, tintColor: 'slate' },
  onAppClick,
  onAddApp,
  onRemoveApp,
  isEditing = false,
  onToggleEdit,
  showDock,
  onToggleDock,
  onStyleChange,
}: HubDockProps) {
  const [expandedDock, setExpandedDock] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const sortedDock = [...dockApps].sort((a, b) => a.position - b.position);
  const slots = Array.from({ length: 5 }, (_, i) => {
    const dockApp = sortedDock.find(d => d.position === i);
    if (dockApp) {
      const app = appRegistry.find(a => a.id === dockApp.appId);
      return { position: i, app, appId: dockApp.appId };
    }
    return { position: i, app: null, appId: null };
  });

  const handleLongPressStart = useCallback(() => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowSettings(true);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleDockClick = useCallback(() => {
    isLongPress.current = false;
  }, []);

  const getTintClass = (tint: string) => {
    const color = DOCK_TINT_COLORS.find(c => c.id === tint);
    return color?.class || 'bg-slate-900';
  };

  if (!showDock) {
    return (
      <button
        onClick={onToggleDock}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 shadow-lg"
        data-testid="dock-expand-btn"
      >
        <ChevronUp className="w-5 h-5 text-slate-400" />
      </button>
    );
  }

  return (
    <>
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 pb-safe transition-transform duration-300",
          expandedDock ? "translate-y-0" : "translate-y-[60px]"
        )}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchCancel={handleLongPressEnd}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        onClick={handleDockClick}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
        
        <div className="relative px-4 pb-4 pt-2">
          <div className="flex justify-center mb-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedDock(!expandedDock);
              }}
              className="p-1 rounded-full bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
              data-testid="dock-toggle-btn"
            >
              {expandedDock ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div 
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-2xl backdrop-blur-xl border border-slate-700/50 shadow-xl transition-all",
                getTintClass(dockStyle.tintColor)
              )}
              style={{ opacity: dockStyle.opacity }}
            >
              {slots.map(({ position, app, appId }) => (
                <div key={position} className="relative">
                  {app ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isEditing && !isLongPress.current) {
                          onAppClick(app);
                        }
                      }}
                      className={cn(
                        "relative w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                        `bg-gradient-to-br ${app.gradient}`,
                        "hover:scale-105 active:scale-95",
                        isEditing && "animate-wiggle"
                      )}
                      data-testid={`dock-app-${app.id}`}
                    >
                      <div className="w-6 h-6 text-white [&>svg]:w-full [&>svg]:h-full">{app.icon}</div>
                      {isEditing && onRemoveApp && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveApp(appId!);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
                          data-testid={`dock-remove-${app.id}`}
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddApp?.(position);
                      }}
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        "bg-slate-800/50 border-2 border-dashed border-slate-600/50",
                        "hover:border-purple-500/50 hover:bg-slate-700/50 transition-all",
                        !isEditing && "opacity-30"
                      )}
                      disabled={!isEditing}
                      data-testid={`dock-slot-${position}`}
                    >
                      <Plus className="w-5 h-5 text-slate-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isEditing && (
            <p className="text-center text-xs text-slate-500 mt-2">
              Tap empty slots to add apps, tap X to remove
            </p>
          )}

          <p className="text-center text-xs text-slate-600 mt-1">
            Long-press dock for settings
          </p>
        </div>
      </div>

      <BottomSheet open={showSettings} onClose={() => setShowSettings(false)}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Dock Settings
          </h3>
          <button
            onClick={() => setShowSettings(false)}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Eye className="w-4 h-4" />
              Transparency: {Math.round(dockStyle.opacity * 100)}%
            </div>
            <input
              type="range"
              min="30"
              max="100"
              step="5"
              value={dockStyle.opacity * 100}
              onChange={(e) => onStyleChange?.({ opacity: parseInt(e.target.value) / 100 })}
              className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500"
              data-testid="dock-opacity-slider"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>More transparent</span>
              <span>Solid</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Paintbrush className="w-4 h-4" />
              Tint Color
            </div>
            <div className="flex flex-wrap gap-2">
              {DOCK_TINT_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => onStyleChange?.({ tintColor: color.id })}
                  className={cn(
                    "w-10 h-10 rounded-xl transition-all border-2",
                    color.class,
                    dockStyle.tintColor === color.id 
                      ? "border-white scale-110" 
                      : "border-transparent hover:border-white/30"
                  )}
                  data-testid={`dock-color-${color.id}`}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                onToggleEdit?.();
                setShowSettings(false);
              }}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl font-medium transition-all",
                isEditing
                  ? "bg-purple-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              )}
              data-testid="dock-edit-mode-btn"
            >
              {isEditing ? "Done Editing" : "Edit Dock Apps"}
            </button>

            <button
              onClick={() => {
                onToggleDock?.();
                setShowSettings(false);
              }}
              className="py-3 px-4 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
              data-testid="dock-hide-btn"
            >
              Hide Dock
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

export default HubDock;
