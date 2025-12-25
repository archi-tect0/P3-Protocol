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
}

export interface AtlasState {
  idle: boolean;
  listening: boolean;
  speaking: boolean;
  amplitude: number;
}

export interface FaceProps {
  color: string;
  accent?: string;
  glow: number;
  motion: number;
  amplitude: number;
  assetUrl?: string;
  reduceMotion?: boolean;
}
