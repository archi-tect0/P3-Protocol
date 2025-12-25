import { useEffect, useState } from 'react';
import type { FaceProps } from './types';

export function MinimalDotFace({ color, glow, motion, amplitude, reduceMotion }: FaceProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setOffset({
        x: (Math.random() - 0.5) * motion * 3,
        y: (Math.random() - 0.5) * motion * 3,
      });
    }, 500);
    return () => clearInterval(interval);
  }, [motion, reduceMotion]);

  const baseSize = 24;
  const size = baseSize + amplitude * 8;
  const glowSize = 10 + glow * 20;

  return (
    <div
      data-testid="face-minimal-dot"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 40% 40%, ${color}, ${color}88)`,
        boxShadow: `0 0 ${glowSize}px ${color}aa`,
        transform: reduceMotion ? 'none' : `translate(${offset.x}px, ${offset.y}px)`,
        transition: reduceMotion ? 'none' : 'all 300ms ease',
      }}
    />
  );
}
