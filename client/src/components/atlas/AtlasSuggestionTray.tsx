import { useState } from 'react';
import { MotionDiv, MotionButton } from '@/lib/motion';
import { useAtlasStore, AtlasMode } from '@/state/useAtlasStore';
import { Sparkles, ArrowRight, X } from 'lucide-react';

const defaultSuggestions = [
  { id: 's0', label: 'Open Hub', intent: 'hub', category: 'action' as const },
  { id: 's1', label: 'Watch live TV', intent: 'tv', category: 'action' as const },
  { id: 's2', label: 'Check token prices', intent: 'tokens', category: 'query' as const },
  { id: 's3', label: 'Weather forecast', intent: 'weather', category: 'query' as const },
  { id: 's4', label: 'Check my messages', intent: 'messages', category: 'query' as const },
];

export default function AtlasSuggestionTray() {
  return null;
  
  const [dismissed, setDismissed] = useState(false);
  const { suggestions, dissolveInto, mode } = useAtlasStore();
  const displaySuggestions = suggestions.length > 0 ? suggestions : defaultSuggestions;

  const handleSuggestion = (intent: string) => {
    const modeMap: Record<string, AtlasMode> = {
      'hub': 'hub',
      'open hub': 'hub',
      'p3 hub': 'hub',
      'messages': 'messages',
      'metrics': 'metrics',
      'governance': 'governance',
      'notes': 'notes',
      'gallery': 'gallery',
      'payments': 'payments',
      'feed': 'feed',
      'calls': 'calls',
      'directory': 'directory',
      'receipts': 'receipts',
      'inbox': 'inbox',
      'tv': 'tv',
      'tokens': 'tokens',
      'weather': 'weather',
      'ai': 'ai',
      'one': 'one',
      'atlas one': 'one',
      'atlasone': 'one',
      'atlas-one': 'one',
      'gamedeck': 'gamedeck',
      'game deck': 'gamedeck',
      'game-deck': 'gamedeck',
      'games': 'gamedeck',
      'media': 'media',
      'movies': 'media',
      'reader': 'reader',
      'books': 'reader',
      'ebooks': 'reader',
      'news': 'news',
      'headlines': 'news',
      'pulse': 'pulse',
      'node': 'node',
      'pulse node': 'node',
    };
    
    const targetMode = modeMap[intent.toLowerCase()] || 'idle';
    dissolveInto(targetMode);
  };

  if (mode !== 'idle' || dismissed) {
    return null;
  }

  return (
    <MotionDiv 
      className="absolute bottom-6 right-6 z-20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.5 }}
      data-testid="atlas-suggestion-tray"
    >
      <div className="flex items-center justify-between gap-2 mb-3 text-white/50 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          <span>Suggestions</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-full hover:bg-white/10 transition-colors"
          data-testid="button-dismiss-suggestions"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      
      <div className="flex flex-col gap-2">
        {displaySuggestions.slice(0, 4).map((suggestion: any, index: number) => (
          <MotionButton
            key={suggestion.id}
            onClick={() => handleSuggestion(suggestion.intent)}
            className="group flex items-center gap-3 px-4 py-2.5 rounded-xl 
                       bg-white/5 border border-white/10 backdrop-blur-sm
                       hover:bg-white/10 hover:border-white/20 transition-all duration-300
                       text-left"
            whileHover={{ x: 4 }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + index * 0.1 }}
            data-testid={`suggestion-${suggestion.id}`}
          >
            <span className="text-sm text-white/70 group-hover:text-white/90">
              {suggestion.label}
            </span>
            <ArrowRight className="w-3 h-3 text-white/30 group-hover:text-cyan-400 
                                   transition-all duration-300 group-hover:translate-x-1" />
          </MotionButton>
        ))}
      </div>
    </MotionDiv>
  );
}
