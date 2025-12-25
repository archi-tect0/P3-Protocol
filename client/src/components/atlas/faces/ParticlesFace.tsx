import { useEffect, useRef } from 'react';
import type { FaceProps } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export function ParticlesFace({ color, glow, motion, amplitude, reduceMotion }: FaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 30; i++) {
        particlesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: 2 + Math.random() * 3,
        });
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      const speedMultiplier = reduceMotion ? 0.1 : motion + amplitude * 0.5;
      
      particlesRef.current.forEach(p => {
        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + amplitude * 0.3), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowBlur = glow * 10;
        ctx.shadowColor = color;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [color, glow, motion, amplitude, reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="face-particles"
      width={200}
      height={160}
      style={{
        boxShadow: `0 0 ${glow * 18}px ${color}44`,
        borderRadius: 8,
      }}
    />
  );
}
