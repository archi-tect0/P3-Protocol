import { useState } from 'react';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useReceipts, Receipt } from '@/hooks/useReceipts';
import { 
  Shield, 
  Check, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  Hash,
  Clock,
  User,
  FileText,
  X
} from 'lucide-react';

interface ReceiptRailProps {
  artifactId?: string;
  maxVisible?: number;
  onReceiptClick?: (receipt: Receipt) => void;
}

export default function ReceiptRail({ 
  artifactId, 
  maxVisible = 4,
  onReceiptClick 
}: ReceiptRailProps) {
  const { receipts } = useReceipts({ artifactId });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (receipts.length === 0) {
    return null;
  }

  const visibleReceipts = showAll ? receipts : receipts.slice(0, maxVisible);
  const hasMore = receipts.length > maxVisible;

  return (
    <MotionDiv 
      className="absolute top-6 right-6 w-[380px] space-y-2 z-20"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      data-testid="receipt-rail"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white/50 text-xs">
          <Shield className="w-3 h-3" />
          <span>Receipt Stream</span>
          <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px]">
            {receipts.length}
          </span>
        </div>
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1 text-[10px] text-cyan-400/70 hover:text-cyan-400 transition-colors"
            data-testid="button-toggle-receipts"
          >
            {showAll ? (
              <>
                Show less <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                Show all ({receipts.length}) <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>
      
      <AnimatePresence mode="popLayout">
        {visibleReceipts.map((receipt, index) => (
          <ReceiptCard
            key={receipt.id}
            receipt={receipt}
            index={index}
            isExpanded={expanded === receipt.id}
            onToggleExpand={() => setExpanded(expanded === receipt.id ? null : receipt.id)}
            onClick={() => onReceiptClick?.(receipt)}
          />
        ))}
      </AnimatePresence>
    </MotionDiv>
  );
}

interface ReceiptCardProps {
  receipt: Receipt;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClick?: () => void;
}

function ReceiptCard({ 
  receipt, 
  index, 
  isExpanded, 
  onToggleExpand,
  onClick 
}: ReceiptCardProps) {
  const hasError = !!receipt.error;
  const borderColor = hasError ? 'from-red-400 to-red-600' : 'from-cyan-400 to-cyan-600';
  const accentColor = hasError ? 'text-red-400/80' : 'text-cyan-400/80';

  const formatHash = (hash: string) => {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    } catch {
      return ts;
    }
  };

  return (
    <MotionDiv
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="relative rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden cursor-pointer"
      onClick={onClick}
      data-testid={`receipt-card-${receipt.id}`}
    >
      <MotionDiv
        className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${borderColor}`}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      />

      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium ${accentColor}`}>
                {receipt.op}
              </span>
              {hasError ? (
                <AlertTriangle className="w-3 h-3 text-red-400" />
              ) : (
                <MotionDiv
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 500 }}
                >
                  <Check className="w-3 h-3 text-green-400" />
                </MotionDiv>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                className="ml-auto p-0.5 rounded hover:bg-white/10 transition-colors"
                data-testid={`button-expand-${receipt.id}`}
              >
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3 text-white/40" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-white/40" />
                )}
              </button>
            </div>
            
            <div className="font-mono text-[10px] text-white/40 truncate flex items-center gap-1">
              <Hash className="w-2.5 h-2.5" />
              {formatHash(receipt.nextHash)}
            </div>
          </div>
          
          <div className="text-[10px] text-white/30 whitespace-nowrap flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatTimestamp(receipt.timestamp)}
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <MotionDiv
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 pt-3 border-t border-white/10"
            >
              <div className="space-y-2 text-[10px]">
                <div className="flex items-start gap-2">
                  <FileText className="w-3 h-3 text-white/40 mt-0.5" />
                  <div>
                    <div className="text-white/50 mb-0.5">Artifact ID</div>
                    <div className="font-mono text-white/70">{formatHash(receipt.artifactId)}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <User className="w-3 h-3 text-white/40 mt-0.5" />
                  <div>
                    <div className="text-white/50 mb-0.5">Actor</div>
                    <div className="font-mono text-white/70">
                      {formatHash(receipt.actor.walletAddress)}
                    </div>
                    <div className="font-mono text-white/40 text-[9px]">
                      Session: {formatHash(receipt.actor.sessionId)}
                    </div>
                  </div>
                </div>

                {receipt.prevHash && (
                  <div className="flex items-start gap-2">
                    <Hash className="w-3 h-3 text-white/40 mt-0.5" />
                    <div>
                      <div className="text-white/50 mb-0.5">Previous Hash</div>
                      <div className="font-mono text-white/70">{formatHash(receipt.prevHash)}</div>
                    </div>
                  </div>
                )}

                {receipt.error && (
                  <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                    <X className="w-3 h-3 text-red-400 mt-0.5" />
                    <div>
                      <div className="text-red-400 font-medium mb-0.5">
                        Error: {receipt.error.code}
                      </div>
                      <div className="text-red-300/80">{receipt.error.message}</div>
                    </div>
                  </div>
                )}

                {receipt.meta && Object.keys(receipt.meta).length > 0 && (
                  <div className="p-2 rounded bg-white/5">
                    <div className="text-white/50 mb-1">Metadata</div>
                    <pre className="font-mono text-[9px] text-white/60 overflow-x-auto">
                      {JSON.stringify(receipt.meta, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>

      <MotionDiv
        className={`absolute inset-0 bg-gradient-to-r ${hasError ? 'from-red-400/10' : 'from-cyan-400/10'} to-transparent pointer-events-none`}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1 }}
      />
    </MotionDiv>
  );
}

export { ReceiptCard };
