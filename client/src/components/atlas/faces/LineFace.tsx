import { useEffect, useState } from 'react';
import type { FaceProps } from './types';

export function LineFace({ color, glow, motion, amplitude, reduceMotion }: FaceProps) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setOffset(prev => (prev + 0.05) % (Math.PI * 2));
    }, 50);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  const yOffset = reduceMotion ? 0 : Math.sin(offset) * motion * 3;
  const thickness = 6 + amplitude * 4;
  const glowSize = 8 + glow * 16;

  return (
    <div
      data-testid="face-line"
      style={{
        height: thickness,
        width: '100%',
        maxWidth: 200,
        background: `linear-gradient(90deg, ${color}55, ${color})`,
        boxShadow: `0 0 ${glowSize}px ${color}88`,
        borderRadius: thickness / 2,
        transform: `translateY(${yOffset}px)`,
        transition: reduceMotion ? 'none' : 'height 150ms ease',
      }}
    />
  );
}
