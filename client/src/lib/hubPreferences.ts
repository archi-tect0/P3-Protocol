export interface DockApp {
  appId: string;
  position: number;
}

export interface HubBackground {
  type: 'gradient' | 'image' | 'ipfs';
  value: string;
}

export interface DockStyle {
  opacity: number; // 0.3 to 1.0
  tintColor: string; // Tailwind color class like 'slate', 'purple', 'cyan'
}

export interface HubPreferences {
  dock: DockApp[];
  background: HubBackground;
  decryptPasswordHash?: string;
  showDock: boolean;
  dockStyle?: DockStyle;
}

const DEFAULT_DOCK: DockApp[] = [
  { appId: 'nexus', position: 0 },
  { appId: 'encrypted-gallery', position: 1 },
  { appId: 'invoice', position: 2 },
  { appId: 'meeting-proof', position: 3 },
];

const DEFAULT_BACKGROUND: HubBackground = {
  type: 'gradient',
  value: 'from-slate-900 via-purple-900/20 to-slate-900',
};

const DEFAULT_DOCK_STYLE: DockStyle = {
  opacity: 0.9,
  tintColor: 'slate',
};

const DEFAULT_PREFERENCES: HubPreferences = {
  dock: DEFAULT_DOCK,
  background: DEFAULT_BACKGROUND,
  showDock: true,
  dockStyle: DEFAULT_DOCK_STYLE,
};

const MAX_DOCK_APPS = 5;

export function hubPreferencesKey(addr: string): string {
  return `p3:hub:prefs:${addr.toLowerCase()}`;
}

export function loadHubPreferences(addr: string): HubPreferences {
  if (!addr || typeof window === 'undefined') {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const key = hubPreferencesKey(addr);
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<HubPreferences>;
      return {
        dock: parsed.dock || DEFAULT_DOCK,
        background: parsed.background || DEFAULT_BACKGROUND,
        decryptPasswordHash: parsed.decryptPasswordHash,
        showDock: parsed.showDock ?? true,
        dockStyle: parsed.dockStyle || DEFAULT_DOCK_STYLE,
      };
    }
  } catch (e) {
    console.error('[HubPreferences] Failed to load preferences:', e);
  }

  return { ...DEFAULT_PREFERENCES };
}

export function saveHubPreferences(addr: string, prefs: HubPreferences): boolean {
  if (!addr || typeof window === 'undefined') {
    return false;
  }

  try {
    const key = hubPreferencesKey(addr);
    localStorage.setItem(key, JSON.stringify(prefs));
    return true;
  } catch (e) {
    console.error('[HubPreferences] Failed to save preferences:', e);
    return false;
  }
}

export function setDockApp(prefs: HubPreferences, appId: string, position: number): HubPreferences {
  if (position < 0 || position >= MAX_DOCK_APPS) {
    return prefs;
  }

  const newDock = prefs.dock.filter(d => d.appId !== appId && d.position !== position);
  newDock.push({ appId, position });
  newDock.sort((a, b) => a.position - b.position);

  return { ...prefs, dock: newDock };
}

export function removeDockApp(prefs: HubPreferences, appId: string): HubPreferences {
  return {
    ...prefs,
    dock: prefs.dock.filter(d => d.appId !== appId),
  };
}

export function setBackground(prefs: HubPreferences, background: HubBackground): HubPreferences {
  return { ...prefs, background };
}

export async function setDecryptPassword(prefs: HubPreferences, password: string): Promise<HubPreferences> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    console.error('[hubPreferences] crypto.subtle not available');
    return prefs;
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return { ...prefs, decryptPasswordHash: hashHex };
}

export function removeDecryptPassword(prefs: HubPreferences): HubPreferences {
  const { decryptPasswordHash, ...rest } = prefs;
  return rest as HubPreferences;
}

export async function verifyDecryptPassword(prefs: HubPreferences, password: string): Promise<boolean> {
  if (!prefs.decryptPasswordHash) {
    return true;
  }

  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    console.error('[hubPreferences] crypto.subtle not available');
    return false;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex === prefs.decryptPasswordHash;
}

export function setDockStyle(prefs: HubPreferences, style: Partial<DockStyle>): HubPreferences {
  return {
    ...prefs,
    dockStyle: { ...prefs.dockStyle || DEFAULT_DOCK_STYLE, ...style },
  };
}

export const DOCK_TINT_COLORS = [
  { id: 'slate', label: 'Slate', class: 'bg-slate-900' },
  { id: 'purple', label: 'Purple', class: 'bg-purple-900' },
  { id: 'cyan', label: 'Cyan', class: 'bg-cyan-900' },
  { id: 'blue', label: 'Blue', class: 'bg-blue-900' },
  { id: 'emerald', label: 'Emerald', class: 'bg-emerald-900' },
  { id: 'rose', label: 'Rose', class: 'bg-rose-900' },
  { id: 'amber', label: 'Amber', class: 'bg-amber-900' },
] as const;

export const BACKGROUND_PRESETS: HubBackground[] = [
  { type: 'gradient', value: 'from-slate-900 via-purple-900/20 to-slate-900' },
  { type: 'gradient', value: 'from-slate-900 via-blue-900/30 to-slate-900' },
  { type: 'gradient', value: 'from-slate-900 via-emerald-900/20 to-slate-900' },
  { type: 'gradient', value: 'from-slate-900 via-rose-900/20 to-slate-900' },
  { type: 'gradient', value: 'from-slate-900 via-amber-900/20 to-slate-900' },
  { type: 'gradient', value: 'from-indigo-950 via-purple-950 to-slate-950' },
  { type: 'gradient', value: 'from-slate-950 via-cyan-950/30 to-slate-950' },
  { type: 'gradient', value: 'from-zinc-950 via-zinc-900 to-zinc-950' },
];
