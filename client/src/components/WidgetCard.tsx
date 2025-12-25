import { WidgetManifest, getWidgetSizeConfig } from '@/lib/widgets';
import { appRegistry } from '@/pages/launcher/appRegistry';
import { cn } from '@/lib/utils';

interface WidgetCardProps {
  widget: WidgetManifest;
  onClick: () => void;
}

export function WidgetCard({ widget, onClick }: WidgetCardProps) {
  const { cols, height } = getWidgetSizeConfig(widget.size);
  const app = appRegistry.find(a => a.id === widget.appId);

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-[12px] bg-slate-800/80 border border-slate-700/50',
        'hover:bg-slate-700/80 hover:border-slate-600/50 transition-all duration-200',
        'flex flex-col items-center justify-center gap-2 p-3',
        'focus:outline-none focus:ring-2 focus:ring-purple-500/50',
        cols === 2 ? 'col-span-2' : 'col-span-1'
      )}
      style={{ height }}
      data-testid={`widget-card-${widget.id}`}
    >
      <div 
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          'bg-gradient-to-br',
          app?.gradient || 'from-slate-600 to-slate-700'
        )}
      >
        <div className="w-5 h-5 text-white">
          {app?.icon}
        </div>
      </div>
      <span className="text-xs font-medium text-white text-center leading-tight">
        {widget.title}
      </span>
      {widget.size !== '1x1' && (
        <span className="text-[10px] text-slate-400 text-center line-clamp-2">
          {widget.description}
        </span>
      )}
    </button>
  );
}

export default WidgetCard;
