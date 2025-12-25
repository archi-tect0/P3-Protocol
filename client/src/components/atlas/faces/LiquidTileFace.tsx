import { useEffect, useState } from 'react';
import type { FaceProps } from './types';

export function LiquidTileFace({ color, glow, motion, amplitude, reduceMotion }: FaceProps) {
  const [gradientAngle, setGradientAngle] = useState(135);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setGradientAngle(prev => (prev + motion * 2) % 360);
    }, 100);
    return () => clearInterval(interval);
  }, [motion, reduceMotion]);

  const size = 160 + amplitude * 10;
  const glowSize = glow * 16;
  const blur = 6 + amplitude * 2;

  return (
    <div
      data-testid="face-liquid-tile"
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        background: `linear-gradient(${gradientAngle}deg, ${color}55, ${color}22)`,
        boxShadow: `0 0 ${glowSize}px ${color}66`,
        backdropFilter: `blur(${blur}px)`,
        border: `1px solid ${color}33`,
        transition: reduceMotion ? 'none' : 'all 150ms ease',
      }}
    />
  );
}
