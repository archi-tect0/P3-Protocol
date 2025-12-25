import { X, Plus, LayoutGrid } from 'lucide-react';
import { getAvailableWidgets, WidgetManifest, getWidgetSizeConfig } from '@/lib/widgets';
import { appRegistry } from '@/pages/launcher/appRegistry';
import { cn } from '@/lib/utils';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widget: WidgetManifest) => void;
  existingWidgetIds: string[];
}

export function AddWidgetModal({ isOpen, onClose, onAddWidget, existingWidgetIds }: AddWidgetModalProps) {
  if (!isOpen) return null;

  const availableWidgets = getAvailableWidgets();

  const handleAddWidget = (widget: WidgetManifest) => {
    onAddWidget(widget);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      data-testid="add-widget-modal"
    >
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md max-h-[80vh] bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-white">Add Widget</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            data-testid="close-widget-modal"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-3">
            {availableWidgets.map((widget) => {
              const app = appRegistry.find(a => a.id === widget.appId);
              const { cols } = getWidgetSizeConfig(widget.size);
              const isAdded = existingWidgetIds.includes(widget.id);

              return (
                <div
                  key={widget.id}
                  className={cn(
                    'relative rounded-xl bg-slate-800/80 border border-slate-700/50 p-4',
                    'flex flex-col gap-3',
                    cols === 2 ? 'col-span-2' : 'col-span-1'
                  )}
                  data-testid={`widget-option-${widget.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        'bg-gradient-to-br',
                        app?.gradient || 'from-slate-600 to-slate-700'
                      )}
                    >
                      <div className="w-5 h-5 text-white">
                        {app?.icon}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">
                        {widget.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">
                        {widget.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                      {widget.size}
                    </span>
                    <button
                      onClick={() => handleAddWidget(widget)}
                      disabled={isAdded}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        isAdded
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                          : 'bg-purple-500 hover:bg-purple-400 text-white'
                      )}
                      data-testid={`add-widget-btn-${widget.id}`}
                    >
                      <Plus className="w-3 h-3" />
                      {isAdded ? 'Added' : 'Add'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddWidgetModal;
