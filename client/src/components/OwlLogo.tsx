export default function OwlLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className}
      data-testid="logo-owl"
    >
      <defs>
        <linearGradient id="owlBodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="owlFaceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="eyeGlowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <rect width="100" height="100" rx="12" fill="#0c1220" />
      
      <g transform="translate(50, 50)">
        <path 
          d="M-30 -8 L-38 0 L-30 8 L-30 -8" 
          fill="url(#owlBodyGradient)"
        />
        <path 
          d="M30 -8 L38 0 L30 8 L30 -8" 
          fill="url(#owlBodyGradient)"
        />
        
        <path 
          d="M0 -35 L-25 -15 L-30 10 L-15 30 L0 25 L15 30 L30 10 L25 -15 Z" 
          fill="url(#owlBodyGradient)"
        />
        
        <path 
          d="M0 -30 L-20 -10 L-22 8 L-8 20 L0 16 L8 20 L22 8 L20 -10 Z" 
          fill="url(#owlFaceGradient)"
        />
        
        <ellipse cx="-12" cy="-2" rx="10" ry="12" fill="#0c1220" />
        <ellipse cx="12" cy="-2" rx="10" ry="12" fill="#0c1220" />
        
        <g filter="url(#glow)">
          <ellipse cx="-12" cy="-2" rx="7" ry="9" fill="url(#eyeGlowGradient)" />
          <ellipse cx="12" cy="-2" rx="7" ry="9" fill="url(#eyeGlowGradient)" />
        </g>
        
        <ellipse cx="-10" cy="-4" rx="2" ry="3" fill="#fff" opacity="0.9" />
        <ellipse cx="14" cy="-4" rx="2" ry="3" fill="#fff" opacity="0.9" />
        
        <circle cx="-12" cy="0" r="2" fill="#0c1220" />
        <circle cx="12" cy="0" r="2" fill="#0c1220" />
        
        <path 
          d="M-5 8 L0 14 L5 8" 
          fill="none" 
          stroke="#f97316" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        
        <path 
          d="M-8 -28 L-15 -38 L-5 -30" 
          fill="url(#owlBodyGradient)"
        />
        <path 
          d="M8 -28 L15 -38 L5 -30" 
          fill="url(#owlBodyGradient)"
        />
        
        <path
          d="M-18 5 L-20 12 L-15 8 M18 5 L20 12 L15 8"
          fill="none"
          stroke="url(#owlFaceGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
