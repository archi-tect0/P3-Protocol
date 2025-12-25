import type { FaceProps } from './types';

export function WaveOrbFace({ color, glow, amplitude, reduceMotion }: FaceProps) {
  const baseSize = 120;
  const scale = reduceMotion ? 1 : 1 + amplitude * 0.15;
  const size = baseSize * scale;
  const glowSize = 8 + glow * 14;

  return (
    <div
      data-testid="face-wave-orb"
      style={{
        height: size,
        width: size,
        borderRadius: '50%',
        background: `conic-gradient(from 180deg, ${color} 0%, ${color}33 50%, ${color} 100%)`,
        boxShadow: `0 0 ${glowSize}px ${color}aa`,
        transition: reduceMotion ? 'none' : 'all 100ms ease',
      }}
    />
  );
}
