import { WidgetManifest, getWidgetById } from '@/lib/widgets';
import { WidgetRef } from '@/lib/hubLayout';
import { WidgetCard } from './WidgetCard';

interface WidgetGridProps {
  widgets: WidgetRef[];
  onWidgetClick: (widget: WidgetManifest) => void;
}

export function WidgetGrid({ widgets, onWidgetClick }: WidgetGridProps) {
  if (widgets.length === 0) {
    return null;
  }

  return (
    <div 
      className="grid grid-cols-4 gap-2"
      data-testid="widget-grid"
    >
      {widgets.map((widgetRef) => {
        const widget = getWidgetById(widgetRef.widgetId);
        if (!widget) return null;
        
        return (
          <WidgetCard
            key={widget.id}
            widget={widget}
            onClick={() => onWidgetClick(widget)}
          />
        );
      })}
    </div>
  );
}

export default WidgetGrid;
