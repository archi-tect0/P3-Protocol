import { useEffect, useState } from 'react';
import type { FaceProps } from './types';

export function HaloRingsFace({ color, glow, motion, amplitude, reduceMotion }: FaceProps) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setPulse(prev => (prev + 0.08) % (Math.PI * 2));
    }, 50);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  const baseSize = 140;
  const pulseAmount = reduceMotion ? 0 : Math.sin(pulse) * motion * 8 + amplitude * 12;
  const glowSize = glow * 20;

  const rings = [
    { size: baseSize + pulseAmount, opacity: 0.3 },
    { size: baseSize * 0.75 + pulseAmount * 0.7, opacity: 0.5 },
    { size: baseSize * 0.5 + pulseAmount * 0.4, opacity: 0.7 },
  ];

  return (
    <div
      data-testid="face-halo-rings"
      style={{
        position: 'relative',
        width: baseSize + 20,
        height: baseSize + 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {rings.map((ring, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: ring.size,
            height: ring.size,
            borderRadius: '50%',
            border: `2px solid ${color}`,
            opacity: ring.opacity,
            boxShadow: `0 0 ${glowSize * ring.opacity}px ${color}`,
            transition: reduceMotion ? 'none' : 'all 100ms ease',
          }}
        />
      ))}
    </div>
  );
}
