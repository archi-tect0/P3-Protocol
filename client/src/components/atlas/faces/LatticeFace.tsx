import { useEffect, useState } from 'react';
import type { FaceProps } from './types';

export function LatticeFace({ color, glow, motion, reduceMotion }: FaceProps) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setOffset(prev => (prev + motion * 0.5) % 20);
    }, 100);
    return () => clearInterval(interval);
  }, [motion, reduceMotion]);

  const glowSize = glow * 12;

  return (
    <div
      data-testid="face-lattice"
      style={{
        width: 160,
        height: 160,
        backgroundImage: `
          linear-gradient(${color}33 1px, transparent 1px),
          linear-gradient(90deg, ${color}33 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        backgroundPosition: reduceMotion ? '0 0' : `${offset}px ${offset}px`,
        boxShadow: `0 0 ${glowSize}px ${color}55`,
        borderRadius: 8,
        transition: reduceMotion ? 'none' : 'background-position 100ms linear',
      }}
    />
  );
}
