import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Globe, MessageSquare, Zap, ArrowRight } from 'lucide-react';

export default function AtlasTile() {
  const [, setLocation] = useLocation();

  return (
    <div className="p-4 text-center">
      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
        <Globe className="w-8 h-8 text-white" />
      </div>
      <h3 className="font-medium text-white mb-1">Atlas</h3>
      <p className="text-xs text-slate-400 mb-3">Talk to your apps</p>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
          <MessageSquare className="w-3 h-3 text-violet-400" />
          <span>Natural language</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
          <Zap className="w-3 h-3 text-violet-400" />
          <span>Cross-app actions</span>
        </div>
      </div>
      
      <Button 
        data-testid="button-open-atlas"
        onClick={() => setLocation('/atlas')}
        className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm"
      >
        Open Atlas
        <ArrowRight className="w-3 h-3 ml-2" />
      </Button>
    </div>
  );
}
