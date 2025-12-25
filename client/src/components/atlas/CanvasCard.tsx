import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Globe, Shield } from 'lucide-react';

interface CanvasField {
  label: string;
  key: string;
  format: 'text' | 'number' | 'currency' | 'percentage' | 'time' | 'date';
}

interface CanvasAction {
  label: string;
  invokeFlow?: string;
  params?: string[];
}

interface CanvasCardProps {
  title: string;
  subtitle?: string;
  fields: CanvasField[];
  data: Record<string, unknown>;
  visibility?: 'public' | 'wallet-gated' | 'admin-only';
  actions?: CanvasAction[];
  onAction?: (action: CanvasAction, data: Record<string, unknown>) => void;
}

export function CanvasCard({ title, subtitle, fields, data, visibility = 'public', actions, onAction }: CanvasCardProps) {
  const formatValue = (value: unknown, format: CanvasField['format']): string => {
    if (value === null || value === undefined) return '-';
    
    switch (format) {
      case 'currency':
        return typeof value === 'number' ? `$${value.toLocaleString()}` : String(value);
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);
      case 'percentage':
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : String(value);
      case 'date':
        return value instanceof Date ? value.toLocaleDateString() : String(value);
      case 'time':
        return value instanceof Date ? value.toLocaleTimeString() : String(value);
      default:
        return String(value);
    }
  };

  const VisibilityIcon = visibility === 'admin-only' ? Shield : visibility === 'wallet-gated' ? Lock : Globe;
  const visibilityColor = visibility === 'admin-only' ? 'destructive' : visibility === 'wallet-gated' ? 'secondary' : 'outline';

  return (
    <Card className="w-full" data-testid="canvas-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg" data-testid="canvas-card-title">{title}</CardTitle>
          <Badge variant={visibilityColor} className="flex items-center gap-1" data-testid="canvas-card-visibility">
            <VisibilityIcon className="h-3 w-3" />
            {visibility}
          </Badge>
        </div>
        {subtitle && <p className="text-sm text-muted-foreground" data-testid="canvas-card-subtitle">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        <div className="space-y-2" data-testid="canvas-card-fields">
          {fields.map((field) => (
            <div key={field.key} className="flex justify-between items-center" data-testid={`canvas-field-${field.key}`}>
              <span className="text-sm text-muted-foreground">{field.label}</span>
              <span className="font-medium">{formatValue(data[field.key], field.format)}</span>
            </div>
          ))}
        </div>
        {actions && actions.length > 0 && (
          <div className="flex gap-2 mt-4" data-testid="canvas-card-actions">
            {actions.map((action, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => onAction?.(action, data)}
                data-testid={`canvas-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CanvasCardListProps {
  items: Record<string, unknown>[];
  fields: CanvasField[];
  title?: string;
  visibility?: 'public' | 'wallet-gated' | 'admin-only';
  actions?: CanvasAction[];
  onAction?: (action: CanvasAction, data: Record<string, unknown>) => void;
}

export function CanvasCardList({ items, fields, title, visibility, actions, onAction }: CanvasCardListProps) {
  return (
    <div className="space-y-4" data-testid="canvas-card-list">
      {title && <h3 className="text-lg font-semibold" data-testid="canvas-card-list-title">{title}</h3>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, idx) => (
          <CanvasCard
            key={idx}
            title={String(item.name || item.title || `Item ${idx + 1}`)}
            fields={fields}
            data={item}
            visibility={visibility}
            actions={actions}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}
