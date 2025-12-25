interface P3HubLogoProps {
  className?: string;
}

export default function P3HubLogo({ className = "w-10" }: P3HubLogoProps) {
  return (
    <svg 
      viewBox="0 0 80 60" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <text 
        x="40" 
        y="28" 
        textAnchor="middle" 
        fontFamily="system-ui, -apple-system, sans-serif" 
        fontWeight="900" 
        fontSize="28"
        fill="currentColor"
      >
        P3
      </text>
      <line x1="8" y1="34" x2="72" y2="34" stroke="currentColor" strokeWidth="1.5" />
      <text 
        x="40" 
        y="48" 
        textAnchor="middle" 
        fontFamily="system-ui, -apple-system, sans-serif" 
        fontWeight="500" 
        fontSize="10"
        letterSpacing="2"
        fill="currentColor"
      >
        {"{ HUB }"}
      </text>
      <line x1="8" y1="54" x2="72" y2="54" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
