import type { AppManifest } from './apps';

export interface MenuAction {
  id: string;
  label: string;
  icon?: string;
  run: (ctx: { appId: string; manifest?: AppManifest | null }) => Promise<void> | void;
}

const REGISTRY: Record<string, MenuAction[]> = {};

export const Menu = {
  register(appId: string, actions: MenuAction[]) {
    REGISTRY[appId] = (REGISTRY[appId] || []).concat(actions);
  },

  unregister(appId: string, actionId?: string) {
    if (!actionId) {
      delete REGISTRY[appId];
    } else {
      REGISTRY[appId] = (REGISTRY[appId] || []).filter(a => a.id !== actionId);
    }
  },

  list(appId: string): MenuAction[] {
    return REGISTRY[appId] || [];
  },

  clear() {
    Object.keys(REGISTRY).forEach(k => delete REGISTRY[k]);
  }
};

export function registerDefaultMenuActions() {
  Menu.register('sketchpad', [
    {
      id: 'open-settings',
      label: 'Open settings',
      run: () => { window.open('/standalone/sketchpad/settings', '_blank', 'noopener'); }
    },
    {
      id: 'export-data',
      label: 'Export drawings',
      run: async ({ appId }) => {
        try {
          const data = await fetch(`/api/${appId}/export`).then(r => r.blob());
          const url = URL.createObjectURL(data);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${appId}-export.zip`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error('Export failed:', e);
        }
      }
    }
  ]);

  Menu.register('whiteboard', [
    {
      id: 'clear-board',
      label: 'Clear board',
      run: () => {
        if (confirm('Clear the entire whiteboard?')) {
          localStorage.removeItem('p3:whiteboard:canvas');
        }
      }
    }
  ]);

  Menu.register('loop', [
    {
      id: 'audio-settings',
      label: 'Audio settings',
      run: () => { window.open('/standalone/loop/settings', '_blank', 'noopener'); }
    }
  ]);
}
