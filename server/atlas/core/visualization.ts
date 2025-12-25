import { db } from '../../db';
import { atlasUserSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';

export type VisualizationTheme =
  | 'line'
  | 'globe'
  | 'avatar'
  | 'particles'
  | 'wave_orb'
  | 'lattice'
  | 'aura'
  | 'minimal_dot'
  | 'typography_face'
  | 'constellation'
  | 'halo_rings'
  | 'liquid_tile'
  | 'ribbon_field';

export interface AtlasVisualizationSettings {
  theme: VisualizationTheme;
  colorPrimary: string;
  colorAccent?: string;
  glowIntensity: number;
  motionLevel: number;
  speakingReactive: boolean;
  listeningReactive: boolean;
  avatarAssetUrl?: string;
  layers?: VisualizationTheme[];
  deviceOverrides?: Record<string, Partial<AtlasVisualizationSettings>>;
}

export interface AccessibilitySettings {
  reduceMotion: boolean;
  highContrast: boolean;
  colorSafe: boolean;
}

export interface PrivacySettings {
  shareThemeAcrossDevices: boolean;
}

export interface AtlasUserSettingsResponse {
  wallet: string;
  visualization: AtlasVisualizationSettings;
  accessibility?: AccessibilitySettings;
  privacy?: PrivacySettings;
  updatedAt: string;
}

const DEFAULT_VISUALIZATION: AtlasVisualizationSettings = {
  theme: 'line',
  colorPrimary: '#5CC8FF',
  glowIntensity: 0.4,
  motionLevel: 0.3,
  speakingReactive: true,
  listeningReactive: true,
};

class VisualizationStore {
  private cache = new Map<string, AtlasUserSettingsResponse>();

  async getSettings(wallet: string): Promise<AtlasUserSettingsResponse> {
    const normalizedWallet = wallet.toLowerCase();
    
    const cached = this.cache.get(normalizedWallet);
    if (cached) {
      return cached;
    }
    
    try {
      const [row] = await db
        .select()
        .from(atlasUserSettings)
        .where(eq(atlasUserSettings.wallet, normalizedWallet))
        .limit(1);
      
      if (row && row.visualization) {
        const settings: AtlasUserSettingsResponse = {
          wallet: normalizedWallet,
          visualization: row.visualization as AtlasVisualizationSettings,
          accessibility: row.accessibility as AccessibilitySettings | undefined,
          updatedAt: row.updatedAt.toISOString(),
        };
        this.cache.set(normalizedWallet, settings);
        return settings;
      }
    } catch (error) {
      console.error('Failed to fetch visualization settings from DB:', error);
    }
    
    return this.getDefaultSettings(wallet);
  }

  getDefaultSettings(wallet: string): AtlasUserSettingsResponse {
    return {
      wallet: wallet.toLowerCase(),
      visualization: { ...DEFAULT_VISUALIZATION },
      updatedAt: new Date().toISOString(),
    };
  }

  async saveSettings(settings: AtlasUserSettingsResponse): Promise<AtlasUserSettingsResponse> {
    const normalizedWallet = settings.wallet.toLowerCase();
    const normalized = {
      ...settings,
      wallet: normalizedWallet,
      updatedAt: new Date().toISOString(),
    };
    
    try {
      const [existing] = await db
        .select({ id: atlasUserSettings.id })
        .from(atlasUserSettings)
        .where(eq(atlasUserSettings.wallet, normalizedWallet))
        .limit(1);
      
      if (existing) {
        await db
          .update(atlasUserSettings)
          .set({
            visualization: settings.visualization,
            accessibility: settings.accessibility || null,
            updatedAt: new Date(),
          })
          .where(eq(atlasUserSettings.wallet, normalizedWallet));
      } else {
        await db
          .insert(atlasUserSettings)
          .values({
            wallet: normalizedWallet,
            visualization: settings.visualization,
            accessibility: settings.accessibility || null,
          });
      }
      
      this.cache.set(normalizedWallet, normalized);
    } catch (error) {
      console.error('Failed to save visualization settings to DB:', error);
    }
    
    return normalized;
  }

  async updateVisualization(
    wallet: string,
    updates: Partial<AtlasVisualizationSettings>
  ): Promise<AtlasUserSettingsResponse> {
    const current = await this.getSettings(wallet);
    const updated: AtlasUserSettingsResponse = {
      ...current,
      visualization: {
        ...current.visualization,
        ...updates,
      },
      updatedAt: new Date().toISOString(),
    };
    return this.saveSettings(updated);
  }

  async updateAccessibility(
    wallet: string,
    updates: Partial<AccessibilitySettings>
  ): Promise<AtlasUserSettingsResponse> {
    const current = await this.getSettings(wallet);
    const updated: AtlasUserSettingsResponse = {
      ...current,
      accessibility: {
        reduceMotion: false,
        highContrast: false,
        colorSafe: false,
        ...current.accessibility,
        ...updates,
      },
      updatedAt: new Date().toISOString(),
    };
    
    if (updates.reduceMotion) {
      updated.visualization.motionLevel = 0.1;
    }
    
    return this.saveSettings(updated);
  }

  async setTheme(wallet: string, theme: VisualizationTheme): Promise<AtlasUserSettingsResponse> {
    return this.updateVisualization(wallet, { theme });
  }

  async setColor(wallet: string, colorPrimary: string, colorAccent?: string): Promise<AtlasUserSettingsResponse> {
    const updates: Partial<AtlasVisualizationSettings> = { colorPrimary };
    if (colorAccent) {
      updates.colorAccent = colorAccent;
    }
    return this.updateVisualization(wallet, updates);
  }

  async setLayers(wallet: string, layers: VisualizationTheme[]): Promise<AtlasUserSettingsResponse> {
    return this.updateVisualization(wallet, { layers });
  }

  async applyDeviceOverride(
    wallet: string,
    deviceId: string,
    overrides: Partial<AtlasVisualizationSettings>
  ): Promise<AtlasUserSettingsResponse> {
    const current = await this.getSettings(wallet);
    const updated: AtlasUserSettingsResponse = {
      ...current,
      visualization: {
        ...current.visualization,
        deviceOverrides: {
          ...current.visualization.deviceOverrides,
          [deviceId]: overrides,
        },
      },
      updatedAt: new Date().toISOString(),
    };
    return this.saveSettings(updated);
  }

  async getEffectiveSettings(wallet: string, deviceId?: string): Promise<AtlasVisualizationSettings> {
    const settings = await this.getSettings(wallet);
    const base = settings.visualization;
    
    if (deviceId && base.deviceOverrides?.[deviceId]) {
      return { ...base, ...base.deviceOverrides[deviceId] };
    }
    
    return base;
  }

  listThemes(): VisualizationTheme[] {
    return [
      'line',
      'globe',
      'avatar',
      'particles',
      'wave_orb',
      'lattice',
      'aura',
      'minimal_dot',
      'typography_face',
      'constellation',
      'halo_rings',
      'liquid_tile',
      'ribbon_field',
    ];
  }

  getThemeMetadata(): Array<{ theme: VisualizationTheme; label: string; description: string }> {
    return [
      { theme: 'line', label: 'Line', description: 'Calm baseline with subtle undulation' },
      { theme: 'globe', label: 'Globe', description: 'Squishy orb that reacts to voice' },
      { theme: 'avatar', label: 'Avatar', description: 'Custom avatar with glow effects' },
      { theme: 'particles', label: 'Particles', description: 'Calm particle field that intensifies when speaking' },
      { theme: 'wave_orb', label: 'Wave Orb', description: 'Liquid sphere rippling with amplitude' },
      { theme: 'lattice', label: 'Lattice', description: 'Geometric mesh shifting softly' },
      { theme: 'aura', label: 'Aura', description: 'Diffuse glow band expanding and contracting' },
      { theme: 'minimal_dot', label: 'Minimal Dot', description: 'Single glowing dot for focus modes' },
      { theme: 'typography_face', label: 'Typography', description: 'Animated ATLAS wordmark' },
      { theme: 'constellation', label: 'Constellation', description: 'Points and lines connecting' },
      { theme: 'halo_rings', label: 'Halo Rings', description: 'Concentric circles pulsing gently' },
      { theme: 'liquid_tile', label: 'Liquid Tile', description: 'Glassmorphism with inner fluid motion' },
      { theme: 'ribbon_field', label: 'Ribbon Field', description: 'Horizontal ribbons bending with voice' },
    ];
  }

  async hasSettings(wallet: string): Promise<boolean> {
    const normalizedWallet = wallet.toLowerCase();
    if (this.cache.has(normalizedWallet)) {
      return true;
    }
    
    try {
      const [row] = await db
        .select({ id: atlasUserSettings.id })
        .from(atlasUserSettings)
        .where(eq(atlasUserSettings.wallet, normalizedWallet))
        .limit(1);
      return !!row;
    } catch {
      return false;
    }
  }

  clearCache(wallet: string): void {
    this.cache.delete(wallet.toLowerCase());
  }
}

export const visualizationStore = new VisualizationStore();
