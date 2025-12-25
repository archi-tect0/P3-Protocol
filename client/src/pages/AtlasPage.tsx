import { useEffect } from 'react';
import { useAtlasStore } from '@/state/useAtlasStore';
import AtlasCanvas from '@/components/atlas/AtlasCanvas';
import AtlasPresence from '@/components/atlas/AtlasPresence';
import AtlasTiles from '@/components/atlas/AtlasTiles';
import AtlasReceiptsBar from '@/components/atlas/AtlasReceiptsBar';
import AtlasSuggestionTray from '@/components/atlas/AtlasSuggestionTray';
import AtlasReturnButton from '@/components/atlas/AtlasReturnButton';

export default function AtlasPage() {
  const { setTiles, setSuggestions } = useAtlasStore();

  useEffect(() => {
    fetch('/api/atlas/manifests')
      .then(r => r.json())
      .then(data => {
        if (data.manifests) {
          setTiles(data.manifests.map((m: any) => ({
            id: m.id,
            title: m.title,
            defaultMode: m.id,
            scopes: m.scopes || [],
            visuals: m.visuals || [],
            renderHints: m.renderHints
          })));
        }
      })
      .catch(() => {});
    
    fetch('/api/atlas/suggestions')
      .then(r => r.json())
      .then(data => {
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {});
  }, [setTiles, setSuggestions]);

  return (
    <div 
      className="h-screen w-screen bg-[#0b0f14] text-white overflow-hidden relative"
      data-testid="atlas-page"
    >
      <AtlasPresence />
      <AtlasCanvas />
      <AtlasTiles />
      <AtlasReceiptsBar />
      <AtlasSuggestionTray />
      <AtlasReturnButton />
      
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-xs text-white/30 tracking-widest uppercase">
          Atlas • P3 Protocol
        </div>
      </div>
    </div>
  );
}
