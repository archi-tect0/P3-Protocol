import { Lock, Shield } from "lucide-react";

interface E2EEBadgeProps {
  variant?: "lock" | "shield";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export default function E2EEBadge({ 
  variant = "lock", 
  size = "sm", 
  showText = true,
  className = "" 
}: E2EEBadgeProps) {
  const Icon = variant === "lock" ? Lock : Shield;
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5"
  };

  return (
    <span className={`
      inline-flex items-center gap-1 rounded
      bg-emerald-50 dark:bg-emerald-900/20 
      text-emerald-700 dark:text-emerald-400
      font-medium
      ${sizeClasses[size]}
      ${className}
    `}>
      <Icon className={iconSizes[size]} />
      {showText && <span>E2EE</span>}
    </span>
  );
}
