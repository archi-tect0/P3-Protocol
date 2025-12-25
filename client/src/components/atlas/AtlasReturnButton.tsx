import { MotionButton, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { X } from 'lucide-react';

export default function AtlasReturnButton() {
  const { mode, returnToPresence } = useAtlasStore();

  return (
    <AnimatePresence>
      {mode !== 'idle' && (
        <MotionButton
          onClick={returnToPresence}
          className="absolute top-6 left-6 p-3 rounded-full
                     bg-white/5 border border-white/10 backdrop-blur-sm
                     hover:bg-white/10 hover:border-white/20 transition-all duration-300
                     text-white/60 hover:text-white"
          initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
          transition={{ duration: 0.3 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          data-testid="atlas-return-button"
        >
          <X className="w-5 h-5" />
        </MotionButton>
      )}
    </AnimatePresence>
  );
}
