import { useMemo } from 'react';
import type { AtlasVisualizationSettings, AtlasState, FaceProps } from './faces/types';
import { LineFace } from './faces/LineFace';
import { GlobeFace } from './faces/GlobeFace';
import { AvatarFace } from './faces/AvatarFace';
import { ParticlesFace } from './faces/ParticlesFace';
import { WaveOrbFace } from './faces/WaveOrbFace';
import { LatticeFace } from './faces/LatticeFace';
import { AuraFace } from './faces/AuraFace';
import { MinimalDotFace } from './faces/MinimalDotFace';
import { TypographyFace } from './faces/TypographyFace';
import { ConstellationFace } from './faces/ConstellationFace';
import { HaloRingsFace } from './faces/HaloRingsFace';
import { LiquidTileFace } from './faces/LiquidTileFace';
import { RibbonFieldFace } from './faces/RibbonFieldFace';

interface AtlasFaceProps {
  settings: AtlasVisualizationSettings;
  state: AtlasState;
  reduceMotion?: boolean;
}

export function AtlasFace({ settings, state, reduceMotion = false }: AtlasFaceProps) {
  const faceProps: FaceProps = useMemo(() => {
    let glowMultiplier = 1;
    if (settings.listeningReactive && state.listening) {
      glowMultiplier *= 1.2;
    }
    if (settings.speakingReactive && state.speaking) {
      glowMultiplier *= 1.3;
    }

    let motionMultiplier = state.idle ? 1 : 0.8;
    if (reduceMotion) {
      motionMultiplier = 0.1;
    }

    return {
      color: settings.colorPrimary,
      accent: settings.colorAccent,
      glow: settings.glowIntensity * glowMultiplier,
      motion: settings.motionLevel * motionMultiplier,
      amplitude: state.amplitude,
      assetUrl: settings.avatarAssetUrl,
      reduceMotion,
    };
  }, [settings, state, reduceMotion]);

  const FaceComponent = useMemo(() => {
    switch (settings.theme) {
      case 'line': return LineFace;
      case 'globe': return GlobeFace;
      case 'avatar': return AvatarFace;
      case 'particles': return ParticlesFace;
      case 'wave_orb': return WaveOrbFace;
      case 'lattice': return LatticeFace;
      case 'aura': return AuraFace;
      case 'minimal_dot': return MinimalDotFace;
      case 'typography_face': return TypographyFace;
      case 'constellation': return ConstellationFace;
      case 'halo_rings': return HaloRingsFace;
      case 'liquid_tile': return LiquidTileFace;
      case 'ribbon_field': return RibbonFieldFace;
      default: return LineFace;
    }
  }, [settings.theme]);

  return (
    <div
      data-testid="atlas-face"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 160,
        padding: 16,
      }}
    >
      <FaceComponent {...faceProps} />
    </div>
  );
}

export const DEFAULT_VISUALIZATION_SETTINGS: AtlasVisualizationSettings = {
  theme: 'line',
  colorPrimary: '#5CC8FF',
  glowIntensity: 0.4,
  motionLevel: 0.3,
  speakingReactive: true,
  listeningReactive: true,
};

export const DEFAULT_ATLAS_STATE: AtlasState = {
  idle: true,
  listening: false,
  speaking: false,
  amplitude: 0.2,
};
