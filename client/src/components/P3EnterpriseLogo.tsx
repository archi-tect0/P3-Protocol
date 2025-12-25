interface P3EnterpriseLogoProps {
  className?: string;
}

export default function P3EnterpriseLogo({ className = "w-10" }: P3EnterpriseLogoProps) {
  return (
    <svg 
      viewBox="0 0 100 60" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <text 
        x="50" 
        y="28" 
        textAnchor="middle" 
        fontFamily="system-ui, -apple-system, sans-serif" 
        fontWeight="900" 
        fontSize="28"
        fill="currentColor"
      >
        P3
      </text>
      <line x1="5" y1="34" x2="95" y2="34" stroke="currentColor" strokeWidth="1.5" />
      <text 
        x="50" 
        y="48" 
        textAnchor="middle" 
        fontFamily="system-ui, -apple-system, sans-serif" 
        fontWeight="500" 
        fontSize="8"
        letterSpacing="1.5"
        fill="currentColor"
      >
        {"{ ENTERPRISE }"}
      </text>
      <line x1="5" y1="54" x2="95" y2="54" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
