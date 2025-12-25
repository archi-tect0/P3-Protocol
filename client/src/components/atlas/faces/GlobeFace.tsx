import type { FaceProps } from './types';

export function GlobeFace({ color, glow, amplitude, reduceMotion }: FaceProps) {
  const baseSize = 120;
  const size = reduceMotion ? baseSize : baseSize + amplitude * 30;
  const glowSize = 10 + glow * 25;

  return (
    <div
      data-testid="face-globe"
      style={{
        height: size,
        width: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${color}99, ${color}33 60%, transparent)`,
        boxShadow: `0 0 ${glowSize}px ${color}aa`,
        transition: reduceMotion ? 'none' : 'all 120ms ease',
      }}
    />
  );
}
