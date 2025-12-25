import { useEffect, useState } from 'react';
import type { FaceProps } from './types';

export function RibbonFieldFace({ color, glow, motion, amplitude, reduceMotion }: FaceProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setPhase(prev => prev + 0.1);
    }, 50);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  const ribbons = [
    { y: 20, amplitude: 8 },
    { y: 40, amplitude: 12 },
    { y: 60, amplitude: 10 },
  ];

  const glowAmount = glow * 12;

  return (
    <svg
      data-testid="face-ribbon-field"
      width="200"
      height="80"
      style={{
        filter: `drop-shadow(0 0 ${glowAmount}px ${color})`,
      }}
    >
      {ribbons.map((ribbon, i) => {
        const waveAmplitude = reduceMotion ? 0 : ribbon.amplitude * motion + amplitude * 8;
        const offset = reduceMotion ? 0 : Math.sin(phase + i * 0.5) * waveAmplitude;
        
        return (
          <path
            key={i}
            d={`M0,${ribbon.y} Q50,${ribbon.y + offset} 100,${ribbon.y} T200,${ribbon.y}`}
            stroke={color}
            strokeWidth={3 + amplitude}
            fill="none"
            strokeLinecap="round"
            opacity={0.6 + i * 0.15}
          />
        );
      })}
    </svg>
  );
}
