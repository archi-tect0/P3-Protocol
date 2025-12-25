import { useEffect, useState } from 'react';

interface AtlasLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  showText?: boolean;
}

export default function AtlasLoader({ 
  size = 'md', 
  text = 'Loading...', 
  showText = true 
}: AtlasLoaderProps) {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(interval);
  }, []);
  
  const dimensions = {
    sm: { svg: 32, stroke: 3 },
    md: { svg: 48, stroke: 4 },
    lg: { svg: 64, stroke: 5 },
  };
  
  const { svg, stroke } = dimensions[size];
  
  return (
    <div 
      className="flex flex-col items-center justify-center gap-3"
      data-testid="atlas-loader"
    >
      <div className="relative">
        <svg 
          width={svg} 
          height={svg} 
          viewBox="0 0 100 100" 
          className="animate-pulse"
        >
          <defs>
            <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="loaderGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
          </defs>
          
          {/* Orbital arcs with rotation animation */}
          <g className="origin-center animate-spin" style={{ animationDuration: '3s' }}>
            <path 
              d="M25 35 Q15 22 28 15 Q40 8 50 18" 
              stroke="url(#loaderGradient)" 
              strokeWidth={stroke} 
              strokeLinecap="round" 
              fill="none"
              opacity="0.6"
            />
            <path 
              d="M75 35 Q85 22 72 15 Q60 8 50 18" 
              stroke="url(#loaderGradient)" 
              strokeWidth={stroke} 
              strokeLinecap="round" 
              fill="none"
              opacity="0.6"
            />
            <path 
              d="M25 65 Q15 78 28 85 Q40 92 50 82" 
              stroke="url(#loaderGradient)" 
              strokeWidth={stroke} 
              strokeLinecap="round" 
              fill="none"
              opacity="0.6"
            />
            <path 
              d="M75 65 Q85 78 72 85 Q60 92 50 82" 
              stroke="url(#loaderGradient)" 
              strokeWidth={stroke} 
              strokeLinecap="round" 
              fill="none"
              opacity="0.6"
            />
          </g>
          
          {/* Infinity symbol with dash animation */}
          <path 
            d="M50 50 
               C50 40 40 32 32 32 
               C22 32 15 40 15 50 
               C15 60 22 68 32 68 
               C40 68 50 60 50 50 
               C50 40 60 32 68 32 
               C78 32 85 40 85 50 
               C85 60 78 68 68 68 
               C60 68 50 60 50 50Z" 
            stroke="url(#loaderGlow)" 
            strokeWidth={stroke + 1} 
            strokeLinecap="round" 
            fill="none"
            strokeDasharray="200"
            strokeDashoffset="0"
            className="animate-[dash_2s_ease-in-out_infinite]"
          />
        </svg>
        
        {/* Glow effect */}
        <div 
          className="absolute inset-0 blur-xl opacity-30 animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)',
          }}
        />
      </div>
      
      {showText && (
        <div className="text-sm text-slate-400 font-medium min-w-[80px] text-center">
          {text}{dots}
        </div>
      )}
      
      <style>{`
        @keyframes dash {
          0% {
            stroke-dashoffset: 200;
          }
          50% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -200;
          }
        }
      `}</style>
    </div>
  );
}

export function AtlasInlineLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <div 
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function AtlasSkeletonCard() {
  return (
    <div 
      className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse"
      data-testid="atlas-skeleton-card"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-500/20" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 bg-white/10 rounded w-full" />
        <div className="h-3 bg-white/10 rounded w-5/6" />
      </div>
    </div>
  );
}

export function AtlasSpinner({ size = 16 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      className="animate-spin"
      data-testid="atlas-spinner"
    >
      <circle 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="2" 
        fill="none"
        strokeDasharray="31.4 31.4"
        strokeLinecap="round"
        className="text-purple-500"
      />
    </svg>
  );
}
