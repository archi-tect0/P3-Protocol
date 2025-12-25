import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Table, Grid, Calculator, ArrowRight } from 'lucide-react';
import { useAtlasStore } from '@/state/useAtlasStore';

export default function CalcTile() {
  const [, setLocation] = useLocation();
  const { setMode } = useAtlasStore();

  const handleOpenCalc = () => {
    setMode('calc');
    setLocation('/atlas');
  };

  return (
    <div className="p-4 text-center" data-testid="calc-tile">
      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
        <Table className="w-8 h-8 text-white" />
      </div>
      <h3 className="font-medium text-white mb-1">Calc</h3>
      <p className="text-xs text-slate-400 mb-3">Create spreadsheets</p>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
          <Grid className="w-3 h-3 text-green-400" />
          <span>Grid-based data</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
          <Calculator className="w-3 h-3 text-green-400" />
          <span>Formulas & calculations</span>
        </div>
      </div>
      
      <Button 
        data-testid="button-open-calc"
        onClick={handleOpenCalc}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm"
      >
        Open Calc
        <ArrowRight className="w-3 h-3 ml-2" />
      </Button>
    </div>
  );
}
