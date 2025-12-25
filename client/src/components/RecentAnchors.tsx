import { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, Anchor } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AnchorEvent {
  id: string;
  appId: string;
  event: string;
  timestamp: number;
  txHash?: string;
  explorerUrl?: string;
}

interface RecentAnchorsProps {
  onClose: () => void;
}

const MAX_ANCHORS = 50;

export default function RecentAnchors({ onClose }: RecentAnchorsProps) {
  const [anchors, setAnchors] = useState<AnchorEvent[]>([]);

  const handleAnchorEvent = useCallback((e: CustomEvent<{
    appId: string;
    event: string;
    txHash?: string;
    explorerUrl?: string;
    timestamp: number;
  }>) => {
    const { appId, event, txHash, explorerUrl, timestamp } = e.detail;
    
    setAnchors(prev => {
      const newAnchor: AnchorEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        appId,
        event,
        timestamp,
        txHash,
        explorerUrl
      };
      return [newAnchor, ...prev].slice(0, MAX_ANCHORS);
    });
  }, []);

  useEffect(() => {
    window.addEventListener('p3:anchor:published', handleAnchorEvent as EventListener);
    return () => {
      window.removeEventListener('p3:anchor:published', handleAnchorEvent as EventListener);
    };
  }, [handleAnchorEvent]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        data-testid="anchors-backdrop"
      />
      
      <div
        data-testid="recent-anchors-panel"
        className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        style={{
          maxHeight: '70vh',
          background: 'rgba(20, 20, 20, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-inherit">
          <div className="flex items-center gap-2">
            <Anchor className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-semibold text-white">Recent Anchors</span>
            {anchors.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                {anchors.length}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
            data-testid="button-close-anchors"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div
          className="overflow-y-auto"
          style={{ maxHeight: 'calc(70vh - 64px)' }}
        >
          {anchors.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                <Anchor className="w-6 h-6 text-purple-400" />
              </div>
              <p className="text-sm text-slate-400 mb-1">No anchor activity yet</p>
              <p className="text-xs text-slate-500">
                Anchors will appear here when proofs are published
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {anchors.map((anchor) => (
                <li
                  key={anchor.id}
                  data-testid={`anchor-item-${anchor.id}`}
                  className="px-4 py-3 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white truncate">
                          {anchor.appId}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {anchor.event}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {formatTime(anchor.timestamp)}
                      </p>
                    </div>
                    {anchor.explorerUrl && (
                      <a
                        href={anchor.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`link-view-anchor-${anchor.id}`}
                        className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors shrink-0"
                      >
                        <span>view</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
