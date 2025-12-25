import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { FileText, Edit3, Save, ArrowRight } from 'lucide-react';
import { useAtlasStore } from '@/state/useAtlasStore';

export default function WriterTile() {
  const [, setLocation] = useLocation();
  const { setMode } = useAtlasStore();

  const handleOpenWriter = () => {
    setMode('writer');
    setLocation('/atlas');
  };

  return (
    <div className="p-4 text-center" data-testid="writer-tile">
      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
        <FileText className="w-8 h-8 text-white" />
      </div>
      <h3 className="font-medium text-white mb-1">Writer</h3>
      <p className="text-xs text-slate-400 mb-3">Create documents</p>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
          <Edit3 className="w-3 h-3 text-blue-400" />
          <span>Rich text editing</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
          <Save className="w-3 h-3 text-blue-400" />
          <span>Auto-save & anchoring</span>
        </div>
      </div>
      
      <Button 
        data-testid="button-open-writer"
        onClick={handleOpenWriter}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm"
      >
        Open Writer
        <ArrowRight className="w-3 h-3 ml-2" />
      </Button>
    </div>
  );
}
