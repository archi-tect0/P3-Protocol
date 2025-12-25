import { useEffect, useState } from 'react';
import type { FaceProps } from './types';

interface Point {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
}

const BASE_POINTS: Array<{ x: number; y: number }> = [
  { x: 30, y: 30 },
  { x: 80, y: 50 },
  { x: 130, y: 25 },
  { x: 50, y: 90 },
  { x: 110, y: 85 },
  { x: 80, y: 130 },
];

const CONNECTIONS = [
  [0, 1], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4], [3, 5], [4, 5],
];

export function ConstellationFace({ color, glow, motion, amplitude, reduceMotion }: FaceProps) {
  const [points, setPoints] = useState<Point[]>(
    BASE_POINTS.map(p => ({ ...p, baseX: p.x, baseY: p.y }))
  );

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setPoints(prev => prev.map((p, i) => ({
        ...p,
        x: p.baseX + Math.sin(Date.now() / 1000 + i) * motion * 5,
        y: p.baseY + Math.cos(Date.now() / 1000 + i * 0.7) * motion * 5,
      })));
    }, 50);
    return () => clearInterval(interval);
  }, [motion, reduceMotion]);

  const dotSize = 4 + amplitude * 3;
  const lineWidth = 1.5 + amplitude;
  const glowAmount = glow * 15;

  return (
    <svg
      data-testid="face-constellation"
      width="160"
      height="160"
      style={{
        filter: `drop-shadow(0 0 ${glowAmount}px ${color})`,
      }}
    >
      {CONNECTIONS.map(([from, to], i) => (
        <line
          key={i}
          x1={points[from].x}
          y1={points[from].y}
          x2={points[to].x}
          y2={points[to].y}
          stroke={color}
          strokeWidth={lineWidth}
          strokeOpacity={0.6 + amplitude * 0.4}
        />
      ))}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={dotSize}
          fill={color}
        />
      ))}
    </svg>
  );
}
