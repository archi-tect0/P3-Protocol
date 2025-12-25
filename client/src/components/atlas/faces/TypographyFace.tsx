import { useEffect, useState } from 'react';
import type { FaceProps } from './types';

export function TypographyFace({ color, glow, motion, amplitude, reduceMotion }: FaceProps) {
  const [letterOffsets, setLetterOffsets] = useState([0, 0, 0, 0, 0]);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setLetterOffsets(prev => 
        prev.map((_, i) => Math.sin(Date.now() / 500 + i * 0.5) * motion * 3 + amplitude * 2)
      );
    }, 50);
    return () => clearInterval(interval);
  }, [motion, amplitude, reduceMotion]);

  const letters = ['A', 'T', 'L', 'A', 'S'];
  const glowSize = 5 + glow * 15;

  return (
    <div
      data-testid="face-typography"
      style={{
        display: 'flex',
        gap: 4,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 700,
        fontSize: 36,
        letterSpacing: 2,
      }}
    >
      {letters.map((letter, i) => (
        <span
          key={i}
          style={{
            color: color,
            textShadow: `0 0 ${glowSize}px ${color}`,
            transform: reduceMotion ? 'none' : `translateY(${letterOffsets[i]}px)`,
            transition: reduceMotion ? 'none' : 'transform 100ms ease',
          }}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}
