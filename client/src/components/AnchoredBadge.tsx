import { Anchor, ExternalLink } from "lucide-react";

interface AnchoredBadgeProps {
  txHash?: string;
  chainId?: number;
  timestamp?: string;
  size?: "sm" | "md";
  showLink?: boolean;
  className?: string;
}

export default function AnchoredBadge({ 
  txHash, 
  chainId = 8453,
  timestamp: _timestamp,
  size = "sm", 
  showLink = true,
  className = "" 
}: AnchoredBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1"
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4"
  };

  const getExplorerUrl = () => {
    if (!txHash) return null;
    const baseUrl = chainId === 8453 
      ? "https://basescan.org/tx/" 
      : "https://sepolia.basescan.org/tx/";
    return `${baseUrl}${txHash}`;
  };

  const explorerUrl = getExplorerUrl();

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`
        inline-flex items-center gap-1 rounded
        bg-indigo-50 dark:bg-indigo-900/20 
        text-indigo-700 dark:text-indigo-400
        font-medium
        ${sizeClasses[size]}
      `}>
        <Anchor className={iconSizes[size]} />
        <span>Anchored</span>
      </span>
      
      {txHash && (
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          {txHash.slice(0, 6)}...{txHash.slice(-4)}
        </span>
      )}
      
      {showLink && explorerUrl && (
        <a 
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
          data-testid="link-explorer"
        >
          <ExternalLink className={iconSizes[size]} />
        </a>
      )}
    </div>
  );
}
