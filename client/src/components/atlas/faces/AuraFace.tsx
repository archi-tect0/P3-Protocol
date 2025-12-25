import { useEffect, useState } from 'react';
import type { FaceProps } from './types';

export function AuraFace({ color, glow, motion, amplitude, reduceMotion }: FaceProps) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setPulse(prev => (prev + 0.1) % (Math.PI * 2));
    }, 50);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  const baseSizeOuter = 140;
  const baseSizeMiddle = 100;
  const baseSizeInner = 60;
  
  const pulseAmount = reduceMotion ? 0 : Math.sin(pulse) * motion * 5 + amplitude * 10;
  const glowSize = 15 + glow * 20;

  return (
    <div
      data-testid="face-aura"
      style={{
        position: 'relative',
        width: baseSizeOuter + pulseAmount,
        height: baseSizeOuter + pulseAmount,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: reduceMotion ? 'none' : 'all 100ms ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: baseSizeOuter + pulseAmount,
          height: baseSizeOuter + pulseAmount,
          borderRadius: '50%',
          background: `radial-gradient(circle, transparent 40%, ${color}22 60%, ${color}44 80%, transparent 100%)`,
          boxShadow: `0 0 ${glowSize}px ${color}66`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: baseSizeMiddle + pulseAmount * 0.7,
          height: baseSizeMiddle + pulseAmount * 0.7,
          borderRadius: '50%',
          background: `radial-gradient(circle, transparent 30%, ${color}33 70%, transparent 100%)`,
        }}
      />
      <div
        style={{
          width: baseSizeInner,
          height: baseSizeInner,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${color}88, ${color}44)`,
          boxShadow: `0 0 ${glow * 10}px ${color}aa`,
        }}
      />
    </div>
  );
}
