export type WidgetSize = '1x1' | '2x1' | '2x2';

export interface WidgetManifest {
  id: string;
  title: string;
  size: WidgetSize;
  appId: string;
  description: string;
}

export const WIDGET_CATALOG: WidgetManifest[] = [
  {
    id: 'sketchpad-widget',
    title: 'Quick Draw',
    size: '1x1',
    appId: 'sketchpad',
    description: 'Quick access to start a new sketch',
  },
  {
    id: 'analytics-widget',
    title: 'Anchor Stats',
    size: '2x1',
    appId: 'analytics',
    description: 'View your anchor statistics at a glance',
  },
  {
    id: 'vote-widget',
    title: 'Active Polls',
    size: '2x1',
    appId: 'vote',
    description: 'See and participate in active polls',
  },
  {
    id: 'receipts-widget',
    title: 'Recent Receipts',
    size: '2x2',
    appId: 'receipts',
    description: 'Browse your recent receipt activity',
  },
  {
    id: 'game-scores-widget',
    title: 'High Scores',
    size: '2x1',
    appId: 'game-asteroid',
    description: 'Display your top game scores',
  },
];

export function getAvailableWidgets(): WidgetManifest[] {
  return [...WIDGET_CATALOG];
}

export function getWidgetById(id: string): WidgetManifest | undefined {
  return WIDGET_CATALOG.find((widget) => widget.id === id);
}

export function getWidgetSizeConfig(size: WidgetSize): { cols: number; height: number } {
  switch (size) {
    case '1x1':
      return { cols: 1, height: 120 };
    case '2x1':
      return { cols: 2, height: 120 };
    case '2x2':
      return { cols: 2, height: 260 };
    default:
      return { cols: 1, height: 120 };
  }
}
