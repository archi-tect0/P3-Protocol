import { useEffect, useRef } from 'react';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import type { PanInfo } from 'framer-motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { Shield, Check, X } from 'lucide-react';

const AUTO_DISMISS_MS = 4000;

export default function AtlasReceiptsBar() {
  const { receipts, removeReceipt } = useAtlasStore();
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const currentIds = new Set(receipts.map(r => r.id));
    
    receipts.forEach((receipt) => {
      if (!timersRef.current.has(receipt.id)) {
        const timer = setTimeout(() => {
          removeReceipt(receipt.id);
          timersRef.current.delete(receipt.id);
        }, AUTO_DISMISS_MS);
        timersRef.current.set(receipt.id, timer);
      }
    });

    timersRef.current.forEach((timer, id) => {
      if (!currentIds.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    });
  }, [receipts, removeReceipt]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const handleDismiss = (id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    removeReceipt(id);
  };

  if (receipts.length === 0) {
    return null;
  }

  return (
    <MotionDiv 
      className="absolute top-20 right-2 md:top-6 md:right-6 w-[280px] md:w-[340px] space-y-2 z-30 pointer-events-auto"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      data-testid="atlas-receipts-bar"
    >
      <div className="flex items-center gap-2 mb-2 text-white/50 text-xs">
        <Shield className="w-3 h-3" />
        <span>Trust Layer</span>
      </div>
      
      <AnimatePresence mode="popLayout">
        {receipts.slice(0, 3).map((receipt, index) => (
          <MotionDiv
            key={receipt.id}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={((_e: unknown, info: PanInfo) => {
              if (info.offset.x > 80) {
                handleDismiss(receipt.id);
              }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any}
            className="relative p-2 md:p-3 rounded-xl bg-slate-900/90 border border-white/10 backdrop-blur-sm overflow-hidden cursor-grab active:cursor-grabbing"
            data-testid={`receipt-${receipt.id}`}
          >
            <MotionDiv
              className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-400 to-cyan-600"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            />
            
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] md:text-xs font-medium text-cyan-400/80 truncate max-w-[150px]">
                    {receipt.scope}
                  </span>
                  <MotionDiv
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 500 }}
                  >
                    <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                  </MotionDiv>
                </div>
                
                <div className="font-mono text-[9px] md:text-[10px] text-white/40 truncate">
                  {receipt.hash.slice(0, 20)}...
                </div>
              </div>
              
              <button
                onClick={() => handleDismiss(receipt.id)}
                className="p-1 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                data-testid={`dismiss-receipt-${receipt.id}`}
              >
                <X className="w-3 h-3 text-white/40 hover:text-white/70" />
              </button>
            </div>

            <MotionDiv
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400/30"
              initial={{ scaleX: 1, originX: 0 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
            />
          </MotionDiv>
        ))}
      </AnimatePresence>
    </MotionDiv>
  );
}
