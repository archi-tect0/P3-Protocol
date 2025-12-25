import { ReactNode, useCallback, useState } from 'react';
import { Star, ArrowRight, Sparkles, LayoutGrid, Plus } from 'lucide-react';
import { AppIcon } from '@/components/LauncherModal';
import { appRegistry, type AppDefinition } from '@/pages/launcher/appRegistry';
import { TileRef, HubLayout } from '@/lib/hubLayout';
import { WidgetGrid } from './WidgetGrid';
import { AddWidgetModal } from './AddWidgetModal';
import { WidgetManifest } from '@/lib/widgets';

interface HomeScreenProps {
  layout: HubLayout;
  session: { address: string } | null;
  onAppClick: (app: AppDefinition) => void;
  onLongPress: (tile: TileRef, icon: ReactNode, gradient: string) => void;
  onAddWidget?: (widget: WidgetManifest) => void;
  onWidgetClick?: (widget: WidgetManifest) => void;
}

export function HomeScreen({ 
  layout, 
  session, 
  onAppClick, 
  onLongPress,
  onAddWidget,
  onWidgetClick,
}: HomeScreenProps) {
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);

  const handleLongPress = useCallback((tile: TileRef, icon: ReactNode, gradient: string) => {
    if (!session) return;
    onLongPress(tile, icon, gradient);
  }, [session, onLongPress]);

  const handleWidgetClick = useCallback((widget: WidgetManifest) => {
    if (onWidgetClick) {
      onWidgetClick(widget);
    } else {
      const app = appRegistry.find(a => a.id === widget.appId);
      if (app) {
        onAppClick(app);
      }
    }
  }, [onWidgetClick, onAppClick]);

  const handleAddWidget = useCallback((widget: WidgetManifest) => {
    if (onAddWidget) {
      onAddWidget(widget);
    }
  }, [onAddWidget]);

  const hasFavorites = layout.favorites.length > 0;
  const hasWidgets = (layout.widgets?.length || 0) > 0;
  const existingWidgetIds = (layout.widgets || []).map(w => w.widgetId);

  return (
    <div className="px-4 py-2" data-testid="home-screen">
      {hasFavorites ? (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
              <Star className="w-3 h-3 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-white">Favorites</h2>
            <span className="text-[10px] text-slate-500">({layout.favorites.length})</span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1">
            {layout.favorites.map((favTile) => {
              const app = appRegistry.find(a => a.id === favTile.appId);
              if (!app) return null;
              return (
                <AppIcon
                  key={app.id}
                  name={app.name}
                  icon={app.icon}
                  gradient={app.gradient}
                  onClick={() => onAppClick(app)}
                  category={app.category}
                  appId={app.id}
                  onLongPress={handleLongPress}
                  isFavorite={true}
                />
              );
            })}
          </div>
        </section>
      ) : !hasWidgets ? (
        <div className="flex flex-col items-center justify-center py-20 px-4" data-testid="home-empty-state">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center mb-4 shadow-lg">
            <Star className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">No favorites yet</h3>
          <p className="text-sm text-slate-400 text-center max-w-[240px] mb-4">
            Long-press any app in the App Drawer to add it to your favorites for quick access.
          </p>
          {!session && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-300">Connect wallet to save favorites</span>
            </div>
          )}
        </div>
      ) : null}

      {(hasFavorites || hasWidgets) && (
        <section className="mb-6" data-testid="widgets-section">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <LayoutGrid className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-sm font-semibold text-white">Widgets</h2>
              {hasWidgets && (
                <span className="text-[10px] text-slate-500">({layout.widgets.length})</span>
              )}
            </div>
            {session && (
              <button
                onClick={() => setIsWidgetModalOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-xs text-slate-300 transition-colors"
                data-testid="add-widget-btn"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>
          
          {hasWidgets ? (
            <WidgetGrid 
              widgets={layout.widgets} 
              onWidgetClick={handleWidgetClick} 
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-slate-800/40 border border-slate-700/30">
              <LayoutGrid className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-500 text-center">
                No widgets added yet
              </p>
              {session && (
                <button
                  onClick={() => setIsWidgetModalOpen(true)}
                  className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-xs text-white font-medium transition-colors"
                  data-testid="add-first-widget-btn"
                >
                  <Plus className="w-3 h-3" />
                  Add Widget
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <div className="flex items-center justify-center gap-2 py-4 text-slate-500" data-testid="swipe-hint">
        <span className="text-xs">Swipe right for all apps</span>
        <ArrowRight className="w-3 h-3" />
      </div>

      <AddWidgetModal
        isOpen={isWidgetModalOpen}
        onClose={() => setIsWidgetModalOpen(false)}
        onAddWidget={handleAddWidget}
        existingWidgetIds={existingWidgetIds}
      />
    </div>
  );
}

export default HomeScreen;
